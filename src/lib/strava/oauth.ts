import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { QueryFailedError } from "typeorm";
import { encryptSecret } from "@/lib/crypto/token-encryption";
import { getDataSource } from "@/lib/db/connection";
import { User } from "@/lib/db/entities/user.entity";
import { optionalEnv, requiredEnv } from "@/lib/env";

const STATE_TTL_MS = 10 * 60 * 1000;
const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/oauth/token";
const STRAVA_SCOPES = "read,activity:read";

export class StravaOAuthError extends Error {
  constructor(
    message: string,
    readonly publicCode:
      | "denied"
      | "invalid_state"
      | "token_exchange"
      | "conflict"
      | "missing_code"
      | "server",
  ) {
    super(message);
    this.name = "StravaOAuthError";
  }
}

type OAuthStatePayload = {
  t: string;
  n: string;
  e: number;
};

type StravaTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
  athlete?: {
    id?: number;
    firstname?: string;
    lastname?: string;
  };
};

function getStateSecret(): string {
  return optionalEnv("OAUTH_STATE_SECRET") ?? requiredEnv("TOKEN_ENCRYPTION_KEY");
}

function signState(payload: string): string {
  return createHmac("sha256", getStateSecret())
    .update(payload)
    .digest("base64url");
}

function signaturesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function createOAuthState(telegramUserId: string): string {
  const payload: OAuthStatePayload = {
    t: telegramUserId,
    n: randomBytes(16).toString("hex"),
    e: Date.now() + STATE_TTL_MS,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${signState(encoded)}`;
}

export function readOAuthState(state: string | null): string {
  if (!state) {
    throw new StravaOAuthError("OAuth state is missing.", "invalid_state");
  }

  const [encoded, signature] = state.split(".");
  if (!encoded || !signature || !signaturesEqual(signState(encoded), signature)) {
    throw new StravaOAuthError("OAuth state is invalid.", "invalid_state");
  }

  let payload: OAuthStatePayload;
  try {
    payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as OAuthStatePayload;
  } catch {
    throw new StravaOAuthError("OAuth state is invalid.", "invalid_state");
  }

  if (!payload.t || payload.e < Date.now()) {
    throw new StravaOAuthError("OAuth state has expired.", "invalid_state");
  }

  return payload.t;
}

export function getStravaRedirectUri(): string {
  return requiredEnv("STRAVA_OAUTH_REDIRECT_URI");
}

export function buildStravaAuthorizeUrl(state: string): string {
  const url = new URL(STRAVA_AUTHORIZE_URL);
  url.searchParams.set("client_id", requiredEnv("STRAVA_CLIENT_ID"));
  url.searchParams.set("redirect_uri", getStravaRedirectUri());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("approval_prompt", "auto");
  url.searchParams.set("scope", STRAVA_SCOPES);
  url.searchParams.set("state", state);
  return url.toString();
}

function truncateName(value: string | undefined): string {
  return (value ?? "").trim().slice(0, 100);
}

async function exchangeStravaCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
  athleteId: string;
  firstName: string;
  lastName: string;
}> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: requiredEnv("STRAVA_CLIENT_ID"),
      client_secret: requiredEnv("STRAVA_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
    }),
  });

  let body: StravaTokenResponse = {};
  try {
    body = (await response.json()) as StravaTokenResponse;
  } catch {
    throw new StravaOAuthError(
      "Strava token response was not JSON.",
      "token_exchange",
    );
  }

  if (
    !response.ok ||
    !body.access_token ||
    !body.refresh_token ||
    !body.expires_at ||
    !body.athlete?.id
  ) {
    throw new StravaOAuthError(
      "Strava token exchange failed.",
      "token_exchange",
    );
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(body.expires_at * 1000),
    athleteId: String(body.athlete.id),
    firstName: truncateName(body.athlete.firstname) || "Athlete",
    lastName: truncateName(body.athlete.lastname),
  };
}

function isUniqueViolation(error: unknown): boolean {
  if (!(error instanceof QueryFailedError)) {
    return false;
  }
  const driverError = error.driverError as { code?: string } | undefined;
  return driverError?.code === "23505";
}

export async function saveStravaUser(
  telegramUserId: string,
  code: string,
): Promise<void> {
  const tokens = await exchangeStravaCode(code);
  const accessEncrypted = encryptSecret(tokens.accessToken);
  const refreshEncrypted = encryptSecret(tokens.refreshToken);
  const dataSource = await getDataSource();

  try {
    await dataSource.transaction(async (manager) => {
      const users = manager.getRepository(User);
      const byTelegram = await users.findOne({
        where: { telegramUserId },
      });
      const byStrava = await users.findOne({
        where: { stravaAthleteId: tokens.athleteId },
      });

      if (byStrava && byStrava.telegramUserId !== telegramUserId) {
        throw new StravaOAuthError(
          "This Strava account is already linked.",
          "conflict",
        );
      }

      if (byTelegram && byStrava && byTelegram.id !== byStrava.id) {
        throw new StravaOAuthError(
          "This Strava account is already linked.",
          "conflict",
        );
      }

      const user = byTelegram ?? users.create({ telegramUserId });
      user.stravaAthleteId = tokens.athleteId;
      user.firstName = tokens.firstName;
      user.lastName = tokens.lastName;
      user.stravaAccessTokenEncrypted = accessEncrypted;
      user.stravaRefreshTokenEncrypted = refreshEncrypted;
      user.stravaTokenExpiresAt = tokens.expiresAt;
      await users.save(user);
    });
  } catch (error) {
    if (error instanceof StravaOAuthError) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new StravaOAuthError(
        "This Strava account is already linked.",
        "conflict",
      );
    }
    throw error;
  }
}

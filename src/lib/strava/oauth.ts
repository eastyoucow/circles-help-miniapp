import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { encryptSecret } from "@/lib/crypto/token-encryption";
import { getDataSource } from "@/lib/db/connection";
import { User } from "@/lib/db/entities/user.entity";
import { optionalEnv, requiredEnv } from "@/lib/env";

const STATE_TTL_MS = 10 * 60 * 1000;
const STRAVA_AUTHORIZE_URL = "https://www.strava.com/oauth/authorize";
const STRAVA_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token";
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
      | "config"
      | "database"
      | "server",
  ) {
    super(message);
    this.name = "StravaOAuthError";
  }
}

const OAUTH_PUBLIC_CODES = [
  "denied",
  "invalid_state",
  "token_exchange",
  "conflict",
  "missing_code",
  "config",
  "database",
  "server",
] as const;

export function getOAuthPublicCode(
  error: unknown,
): StravaOAuthError["publicCode"] | undefined {
  let current: unknown = error;
  for (let i = 0; i < 5 && current; i += 1) {
    if (typeof current === "object" && current !== null) {
      const code = (current as { publicCode?: unknown }).publicCode;
      if (
        typeof code === "string" &&
        (OAUTH_PUBLIC_CODES as readonly string[]).includes(code)
      ) {
        return code as StravaOAuthError["publicCode"];
      }
    }
    current =
      typeof current === "object" &&
      current !== null &&
      "cause" in current
        ? (current as { cause: unknown }).cause
        : undefined;
  }
  return undefined;
}

export function isStravaOAuthError(error: unknown): error is StravaOAuthError {
  return getOAuthPublicCode(error) !== undefined;
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
  return requiredEnv("STRAVA_OAUTH_REDIRECT_URI").replace(/\/+$/, "");
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
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("STRAVA_CLIENT_ID"),
      client_secret: requiredEnv("STRAVA_CLIENT_SECRET"),
      code,
      grant_type: "authorization_code",
      redirect_uri: getStravaRedirectUri(),
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

  const athleteId = body.athlete?.id;
  const expiresAt = Number(body.expires_at);
  if (
    !response.ok ||
    !body.access_token ||
    !body.refresh_token ||
    !Number.isFinite(expiresAt) ||
    athleteId === undefined ||
    athleteId === null
  ) {
    throw new StravaOAuthError(
      "Strava token exchange failed.",
      "token_exchange",
    );
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(expiresAt * 1000),
    athleteId: String(athleteId),
    firstName: truncateName(body.athlete?.firstname) || "Athlete",
    lastName: truncateName(body.athlete?.lastname),
  };
}

function collectErrorText(error: unknown, depth = 0): string {
  if (error == null || depth > 5) {
    return "";
  }
  if (typeof error === "string") {
    return error;
  }
  if (typeof error !== "object") {
    return String(error);
  }

  const parts: string[] = [];
  const rec = error as {
    name?: unknown;
    message?: unknown;
    code?: unknown;
    driverError?: unknown;
    cause?: unknown;
    errors?: unknown;
  };
  if (typeof rec.name === "string") {
    parts.push(rec.name);
  }
  if (typeof rec.message === "string") {
    parts.push(rec.message);
  }
  if (rec.code != null) {
    parts.push(String(rec.code));
  }
  if (rec.driverError) {
    parts.push(collectErrorText(rec.driverError, depth + 1));
  }
  if (rec.cause) {
    parts.push(collectErrorText(rec.cause, depth + 1));
  }
  if (Array.isArray(rec.errors)) {
    for (const inner of rec.errors) {
      parts.push(collectErrorText(inner, depth + 1));
    }
  }
  return parts.filter(Boolean).join(" ");
}

function isUniqueViolation(error: unknown): boolean {
  const text = collectErrorText(error);
  if (/\b23505\b/.test(text) || /unique constraint/i.test(text)) {
    return true;
  }
  const withDriver = error as { driverError?: { code?: string }; code?: string };
  return withDriver.driverError?.code === "23505" || withDriver.code === "23505";
}

function rethrowKnown(error: unknown): never {
  if (isStravaOAuthError(error)) {
    throw error;
  }

  const message = collectErrorText(error) || "Unknown OAuth save error";
  console.error("strava oauth save failed", message, error);

  if (
    message.includes("is not set") ||
    /TOKEN_ENCRYPTION_KEY|STRAVA_CLIENT_|STRAVA_OAUTH_REDIRECT_URI/i.test(
      message,
    )
  ) {
    throw new StravaOAuthError(message, "config");
  }
  if (
    /ECONNREFUSED|ENOTFOUND|ETIMEDOUT|ENETUNREACH|EHOSTUNREACH|ECONNRESET|EAI_AGAIN|getaddrinfo|AggregateError|timeout expired|Connection terminated|no pg_hba|self.signed|SASL|password authentication failed|DATABASE_|relation ".*?" does not exist|column ".*?" does not exist|Postgres package|DriverPackageNotInstalled|Unable to connect to the database|connect ENO|ssl/i.test(
      message,
    )
  ) {
    throw new StravaOAuthError(message, "database");
  }
  throw new StravaOAuthError(message, "server");
}

export async function saveStravaUser(
  telegramUserId: string,
  code: string,
): Promise<void> {
  let tokens: Awaited<ReturnType<typeof exchangeStravaCode>>;
  try {
    tokens = await exchangeStravaCode(code);
  } catch (error) {
    rethrowKnown(error);
  }

  let accessEncrypted: string;
  let refreshEncrypted: string;
  try {
    accessEncrypted = encryptSecret(tokens.accessToken);
    refreshEncrypted = encryptSecret(tokens.refreshToken);
  } catch (error) {
    rethrowKnown(error);
  }

  let dataSource;
  try {
    dataSource = await getDataSource();
  } catch (error) {
    rethrowKnown(error);
  }

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
    if (isStravaOAuthError(error)) {
      throw error;
    }
    if (isUniqueViolation(error)) {
      throw new StravaOAuthError(
        "This Strava account is already linked.",
        "conflict",
      );
    }
    rethrowKnown(error);
  }
}

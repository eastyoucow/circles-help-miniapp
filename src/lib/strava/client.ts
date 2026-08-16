import { decryptSecret, encryptSecret } from "@/lib/crypto/token-encryption";
import { saveUser } from "@/lib/db/users";
import { User } from "@/lib/db/entities/user.entity";
import { requiredEnv } from "@/lib/env";

const STRAVA_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token";
const STRAVA_ATHLETE_URL = "https://www.strava.com/api/v3/athlete";
const REFRESH_SKEW_MS = 2 * 60 * 1000;

export type StravaAthleteProfile = {
  firstname: string;
  lastname: string;
  profile: string;
};

type StravaTokenResponse = {
  access_token?: string;
  refresh_token?: string;
  expires_at?: number;
};

type StravaAthleteResponse = {
  firstname?: string;
  lastname?: string;
  profile?: string;
};

export class StravaApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "StravaApiError";
  }
}

async function refreshStravaTokens(refreshToken: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
}> {
  const response = await fetch(STRAVA_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: requiredEnv("STRAVA_CLIENT_ID"),
      client_secret: requiredEnv("STRAVA_CLIENT_SECRET"),
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });

  let body: StravaTokenResponse = {};
  try {
    body = (await response.json()) as StravaTokenResponse;
  } catch {
    throw new StravaApiError("Strava token refresh was not JSON.", 502);
  }

  const expiresAt = Number(body.expires_at);
  if (
    !response.ok ||
    !body.access_token ||
    !body.refresh_token ||
    !Number.isFinite(expiresAt)
  ) {
    throw new StravaApiError("Strava token refresh failed.", 502);
  }

  return {
    accessToken: body.access_token,
    refreshToken: body.refresh_token,
    expiresAt: new Date(expiresAt * 1000),
  };
}

export async function getValidStravaAccessToken(user: User): Promise<string> {
  const expiresAt = user.stravaTokenExpiresAt.getTime();
  if (expiresAt - REFRESH_SKEW_MS > Date.now()) {
    return decryptSecret(user.stravaAccessTokenEncrypted);
  }

  const refreshed = await refreshStravaTokens(
    decryptSecret(user.stravaRefreshTokenEncrypted),
  );
  user.stravaAccessTokenEncrypted = encryptSecret(refreshed.accessToken);
  user.stravaRefreshTokenEncrypted = encryptSecret(refreshed.refreshToken);
  user.stravaTokenExpiresAt = refreshed.expiresAt;
  await saveUser(user);
  return refreshed.accessToken;
}

async function requestAthlete(
  accessToken: string,
): Promise<StravaAthleteProfile> {
  const response = await fetch(STRAVA_ATHLETE_URL, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });

  if (response.status === 401) {
    throw new StravaApiError("Strava access token was rejected.", 401);
  }

  let body: StravaAthleteResponse = {};
  try {
    body = (await response.json()) as StravaAthleteResponse;
  } catch {
    throw new StravaApiError("Strava athlete response was not JSON.", 502);
  }

  if (!response.ok) {
    throw new StravaApiError("Strava athlete request failed.", 502);
  }

  return {
    firstname: (body.firstname ?? "").trim() || "Athlete",
    lastname: (body.lastname ?? "").trim(),
    profile: (body.profile ?? "").trim(),
  };
}

export async function fetchStravaAthlete(
  user: User,
): Promise<StravaAthleteProfile> {
  const accessToken = await getValidStravaAccessToken(user);
  try {
    return await requestAthlete(accessToken);
  } catch (error) {
    if (!(error instanceof StravaApiError) || error.status !== 401) {
      throw error;
    }

    const refreshed = await refreshStravaTokens(
      decryptSecret(user.stravaRefreshTokenEncrypted),
    );
    user.stravaAccessTokenEncrypted = encryptSecret(refreshed.accessToken);
    user.stravaRefreshTokenEncrypted = encryptSecret(refreshed.refreshToken);
    user.stravaTokenExpiresAt = refreshed.expiresAt;
    await saveUser(user);
    return requestAthlete(refreshed.accessToken);
  }
}

import { decryptSecret, encryptSecret } from "@/lib/crypto/token-encryption";
import { saveUser } from "@/lib/db/users";
import { User } from "@/lib/db/entities/user.entity";
import { requiredEnv } from "@/lib/env";

const STRAVA_TOKEN_URL = "https://www.strava.com/api/v3/oauth/token";
const STRAVA_ATHLETE_URL = "https://www.strava.com/api/v3/athlete";
const STRAVA_ACTIVITIES_URL = "https://www.strava.com/api/v3/athlete/activities";
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

export type StravaActivitySummary = {
  id: string;
  title: string;
};

export type StravaActivityDetails = {
  id: string;
  title: string;
  description: string;
  activityDate: Date;
  distance: number;
  movingTime: number;
  workoutType: number | null;
};

type StravaActivityResponse = {
  id?: number;
  name?: string;
  description?: string | null;
  start_date?: string;
  distance?: number;
  moving_time?: number;
  workout_type?: number | null;
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

function stravaErrorMessage(body: unknown, fallback: string): string {
  if (!body || typeof body !== "object") {
    return fallback;
  }
  const rec = body as { message?: unknown; errors?: unknown };
  const parts: string[] = [];
  if (typeof rec.message === "string" && rec.message.trim()) {
    parts.push(rec.message.trim());
  }
  if (Array.isArray(rec.errors)) {
    for (const item of rec.errors) {
      if (!item || typeof item !== "object") {
        continue;
      }
      const err = item as {
        resource?: unknown;
        field?: unknown;
        code?: unknown;
      };
      const detail = [err.resource, err.field, err.code]
        .filter((value): value is string => typeof value === "string")
        .join(" ");
      if (detail) {
        parts.push(detail);
      }
    }
  }
  return parts.join(": ") || fallback;
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

async function persistRefreshedTokens(
  user: User,
  refreshed: Awaited<ReturnType<typeof refreshStravaTokens>>,
): Promise<string> {
  user.stravaAccessTokenEncrypted = encryptSecret(refreshed.accessToken);
  user.stravaRefreshTokenEncrypted = encryptSecret(refreshed.refreshToken);
  user.stravaTokenExpiresAt = refreshed.expiresAt;
  await saveUser(user);
  return refreshed.accessToken;
}

export async function getValidStravaAccessToken(user: User): Promise<string> {
  const expiresAt = user.stravaTokenExpiresAt.getTime();
  if (expiresAt - REFRESH_SKEW_MS > Date.now()) {
    return decryptSecret(user.stravaAccessTokenEncrypted);
  }

  return persistRefreshedTokens(
    user,
    await refreshStravaTokens(decryptSecret(user.stravaRefreshTokenEncrypted)),
  );
}

export async function withStravaUserToken<T>(
  user: User,
  fn: (accessToken: string) => Promise<T>,
): Promise<T> {
  try {
    return await fn(await getValidStravaAccessToken(user));
  } catch (error) {
    if (!(error instanceof StravaApiError) || error.status !== 401) {
      throw error;
    }
    const accessToken = await persistRefreshedTokens(
      user,
      await refreshStravaTokens(
        decryptSecret(user.stravaRefreshTokenEncrypted),
      ),
    );
    return fn(accessToken);
  }
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
  const athlete = await withStravaUserToken(user, requestAthlete);
  const imageUrl = (athlete.profile ?? "").trim().slice(0, 2048);
  if (imageUrl && imageUrl !== user.profileImageUrl) {
    user.profileImageUrl = imageUrl;
    await saveUser(user);
  }
  return athlete;
}

function parseActivityId(value: unknown): string | null {
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  if (typeof value === "string" && /^\d+$/.test(value)) {
    return value;
  }
  return null;
}

function mapActivitySummary(body: StravaActivityResponse): StravaActivitySummary | null {
  const id = parseActivityId(body.id);
  if (!id) {
    return null;
  }
  return {
    id,
    title: (body.name ?? "").trim(),
  };
}

function mapActivityDetails(body: StravaActivityResponse): StravaActivityDetails | null {
  const summary = mapActivitySummary(body);
  const startDate = body.start_date ? new Date(body.start_date) : null;
  const distance = Number(body.distance);
  const movingTime = Number(body.moving_time);
  if (
    !summary ||
    !startDate ||
    Number.isNaN(startDate.getTime()) ||
    !Number.isFinite(distance) ||
    !Number.isFinite(movingTime) ||
    movingTime < 0
  ) {
    return null;
  }

  return {
    id: summary.id,
    title: summary.title.slice(0, 255) || "Activity",
    description: (body.description ?? "").trim(),
    activityDate: startDate,
    distance,
    movingTime: Math.round(movingTime),
    workoutType:
      typeof body.workout_type === "number" && Number.isInteger(body.workout_type)
        ? body.workout_type
        : null,
  };
}

async function stravaGetJson(
  accessToken: string,
  url: string,
): Promise<{ ok: boolean; status: number; body: unknown }> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${accessToken}` },
    cache: "no-store",
  });
  if (response.status === 401) {
    throw new StravaApiError("Strava access token was rejected.", 401);
  }

  let body: unknown = null;
  try {
    body = await response.json();
  } catch {
    throw new StravaApiError("Strava response was not JSON.", 502);
  }

  return { ok: response.ok, status: response.status, body };
}

export async function listAthleteActivities(
  accessToken: string,
  options: { after: number; page: number; perPage: number },
): Promise<StravaActivitySummary[]> {
  const url = new URL(STRAVA_ACTIVITIES_URL);
  url.searchParams.set("after", String(options.after));
  url.searchParams.set("page", String(options.page));
  url.searchParams.set("per_page", String(options.perPage));

  const { ok, status, body } = await stravaGetJson(accessToken, url.toString());
  if (!ok || !Array.isArray(body)) {
    console.error("strava athlete activities failed", {
      status,
      after: options.after,
      page: options.page,
      perPage: options.perPage,
      body,
    });
    const message = stravaErrorMessage(
      body,
      "Strava activity list request failed.",
    );
    const withHint = /activity:read/i.test(message)
      ? `${message} Re-link Strava in the Mini App and keep activity access checked.`
      : message;
    throw new StravaApiError(withHint, ok ? 502 : status);
  }

  return body.flatMap((item) => {
    const mapped = mapActivitySummary(item as StravaActivityResponse);
    return mapped ? [mapped] : [];
  });
}

export async function getActivityById(
  accessToken: string,
  activityId: string,
): Promise<StravaActivityDetails | null> {
  const { ok, status, body } = await stravaGetJson(
    accessToken,
    `https://www.strava.com/api/v3/activities/${activityId}`,
  );
  if (status === 404) {
    return null;
  }
  if (!ok) {
    console.error("strava activity by id failed", { status, activityId, body });
    throw new StravaApiError(
      stravaErrorMessage(body, "Strava activity request failed."),
      status,
    );
  }
  return mapActivityDetails(body as StravaActivityResponse);
}

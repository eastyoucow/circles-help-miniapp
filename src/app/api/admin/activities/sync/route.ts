import { NextResponse } from "next/server";
import { authenticateAdmin } from "@/lib/auth/admin";
import { findUserByTelegramId } from "@/lib/db/users";
import { StravaApiError } from "@/lib/strava/client";
import {
  clampActivityPageSize,
  syncUserActivitiesAfter,
} from "@/lib/strava/sync-activities";

export const runtime = "nodejs";
export const maxDuration = 60;

type SyncBody = {
  telegramUserId?: unknown;
  after?: unknown;
  page?: unknown;
  perPage?: unknown;
};

function parseAfter(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value) && value > 0) {
    return Math.floor(value);
  }
  if (typeof value === "string" && value.trim()) {
    if (/^\d+$/.test(value.trim())) {
      return Number(value.trim());
    }
    const fromDate = Date.parse(value);
    if (Number.isFinite(fromDate)) {
      return Math.floor(fromDate / 1000);
    }
  }
  return null;
}

function parsePositiveInt(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isInteger(value)) {
    return value;
  }
  if (typeof value === "string" && /^\d+$/.test(value.trim())) {
    return Number(value.trim());
  }
  return undefined;
}

export async function POST(request: Request) {
  let body: SyncBody = {};
  try {
    body = (await request.json()) as SyncBody;
  } catch {
    body = {};
  }

  const admin = authenticateAdmin(request, body);
  if (!admin.ok) {
    return NextResponse.json({ error: admin.error }, { status: admin.status });
  }

  const telegramUserId =
    typeof body.telegramUserId === "string"
      ? body.telegramUserId.trim()
      : typeof body.telegramUserId === "number"
        ? String(body.telegramUserId)
        : "";
  if (!telegramUserId) {
    return NextResponse.json(
      { error: "telegramUserId is required." },
      { status: 400 },
    );
  }

  const after = parseAfter(body.after);
  if (after === null) {
    return NextResponse.json(
      { error: "after is required as a Unix timestamp (seconds) or ISO date." },
      { status: 400 },
    );
  }

  const page = parsePositiveInt(body.page) ?? 1;
  const perPage = clampActivityPageSize(parsePositiveInt(body.perPage));

  let user;
  try {
    user = await findUserByTelegramId(telegramUserId);
  } catch (error) {
    console.error("admin activity sync user lookup failed", error);
    return NextResponse.json(
      { error: "Could not look up the user." },
      { status: 503 },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "No linked Strava user for that Telegram id." },
      { status: 404 },
    );
  }

  try {
    const result = await syncUserActivitiesAfter({
      user,
      after,
      page,
      perPage,
    });
    return NextResponse.json(result);
  } catch (error) {
    const status = error instanceof StravaApiError ? error.status : 502;
    console.error("admin activity sync failed", error);
    return NextResponse.json(
      { error: "Could not sync Strava activities." },
      { status: status === 401 ? 401 : 502 },
    );
  }
}

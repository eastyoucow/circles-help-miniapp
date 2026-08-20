import { NextResponse } from "next/server";
import { authenticateCron } from "@/lib/auth/cron";
import { syncAllUsersActivitiesAfter } from "@/lib/strava/sync-activities";

export const runtime = "nodejs";
export const maxDuration = 60;

const LOOKBACK_SECONDS = 24 * 60 * 60;

export async function GET(request: Request) {
  const auth = authenticateCron(request);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.error }, { status: auth.status });
  }

  const after = Math.floor(Date.now() / 1000) - LOOKBACK_SECONDS;

  try {
    const result = await syncAllUsersActivitiesAfter(after);
    return NextResponse.json(result);
  } catch (error) {
    console.error("cron activity sync failed", error);
    return NextResponse.json(
      { error: "Could not sync Strava activities." },
      { status: 503 },
    );
  }
}

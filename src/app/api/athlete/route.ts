import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/request-user";
import { findUserByTelegramId } from "@/lib/db/users";
import { fetchStravaAthlete, StravaApiError } from "@/lib/strava/client";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Sign in from Telegram or link Strava first." },
      { status: 401 },
    );
  }

  let user;
  try {
    user = await findUserByTelegramId(auth.telegramUserId);
  } catch (error) {
    console.error("athlete lookup failed", error);
    return NextResponse.json(
      { error: "Could not look up the current user." },
      { status: 503 },
    );
  }

  if (!user) {
    return NextResponse.json(
      { error: "Strava is not connected." },
      { status: 404 },
    );
  }

  try {
    const athlete = await fetchStravaAthlete(user);
    return NextResponse.json(athlete);
  } catch (error) {
    const status = error instanceof StravaApiError ? error.status : 502;
    console.error("strava athlete request failed", error);
    return NextResponse.json(
      { error: "Could not load the Strava athlete." },
      { status: status === 401 ? 401 : 502 },
    );
  }
}

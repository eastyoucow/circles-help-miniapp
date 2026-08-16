import { NextResponse } from "next/server";
import {
  readOAuthState,
  saveStravaUser,
  StravaOAuthError,
} from "@/lib/strava/oauth";

export const runtime = "nodejs";

function redirectHome(request: Request, strava: string): NextResponse {
  const url = new URL("/", request.url);
  url.searchParams.set("strava", strava);
  return NextResponse.redirect(url);
}

export async function GET(request: Request) {
  const url = new URL(request.url);

  if (url.searchParams.get("error") === "access_denied") {
    return redirectHome(request, "denied");
  }

  const code = url.searchParams.get("code");
  if (!code) {
    return redirectHome(request, "missing_code");
  }

  let telegramUserId: string;
  try {
    telegramUserId = readOAuthState(url.searchParams.get("state"));
  } catch (error) {
    const codeName =
      error instanceof StravaOAuthError ? error.publicCode : "invalid_state";
    return redirectHome(request, codeName);
  }

  try {
    await saveStravaUser(telegramUserId, code);
  } catch (error) {
    if (error instanceof StravaOAuthError) {
      return redirectHome(request, error.publicCode);
    }
    console.error("strava oauth callback failed", error);
    return redirectHome(request, "server");
  }

  return redirectHome(request, "connected");
}

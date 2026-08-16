import { NextResponse } from "next/server";
import { buildStravaAuthorizeUrl, createOAuthState } from "@/lib/strava/oauth";
import { readTelegramInitData } from "@/lib/telegram/read-init-data";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

export const runtime = "nodejs";

export async function POST(request: Request) {
  let body: unknown = null;
  try {
    body = await request.json();
  } catch {
    body = null;
  }

  const initData = readTelegramInitData(request, body);
  if (!initData) {
    return NextResponse.json(
      { error: "Telegram initData is required." },
      { status: 400 },
    );
  }

  let telegramUserId: string;
  try {
    telegramUserId = String(verifyTelegramInitData(initData).id);
  } catch {
    return NextResponse.json(
      { error: "Telegram initData is invalid." },
      { status: 401 },
    );
  }

  try {
    const state = createOAuthState(telegramUserId);
    return NextResponse.json({ authorizeUrl: buildStravaAuthorizeUrl(state) });
  } catch (error) {
    console.error("strava oauth start failed", error);
    return NextResponse.json(
      { error: "Strava OAuth is not configured." },
      { status: 503 },
    );
  }
}

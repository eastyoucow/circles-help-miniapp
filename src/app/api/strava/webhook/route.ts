import { NextResponse } from "next/server";
import {
  getStravaWebhookVerifyToken,
  isValidStravaVerifyToken,
  parseStravaWebhookEvent,
  processStravaWebhookEvent,
} from "@/lib/strava/webhook";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const challenge = url.searchParams.get("hub.challenge");
  const verifyToken = url.searchParams.get("hub.verify_token");

  let expected: string;
  try {
    expected = getStravaWebhookVerifyToken();
  } catch {
    return NextResponse.json(
      { error: "STRAVA_WEBHOOK_VERIFY_TOKEN is not configured." },
      { status: 503 },
    );
  }

  if (
    mode !== "subscribe" ||
    !challenge ||
    !isValidStravaVerifyToken(verifyToken, expected)
  ) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  return NextResponse.json({ "hub.challenge": challenge });
}

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const event = parseStravaWebhookEvent(body);
  if (!event) {
    return NextResponse.json({ error: "Invalid event" }, { status: 400 });
  }

  try {
    await processStravaWebhookEvent(event);
  } catch (error) {
    console.error("strava webhook processing failed", error);
    return NextResponse.json({ ok: false }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

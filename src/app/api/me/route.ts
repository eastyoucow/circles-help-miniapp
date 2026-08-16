import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/request-user";
import { findUserByTelegramId } from "@/lib/db/users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth.ok) {
    if (auth.reason === "invalid") {
      return NextResponse.json(
        { authenticated: false, error: "Telegram initData is invalid." },
        { status: 401 },
      );
    }
    return NextResponse.json({ authenticated: false });
  }

  try {
    const user = await findUserByTelegramId(auth.telegramUserId);
    return NextResponse.json({ authenticated: Boolean(user) });
  } catch (error) {
    console.error("me lookup failed", error);
    return NextResponse.json(
      { authenticated: false, error: "Could not look up the current user." },
      { status: 503 },
    );
  }
}

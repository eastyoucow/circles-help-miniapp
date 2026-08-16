import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/request-user";
import { findUserByTelegramId } from "@/lib/db/users";

export const runtime = "nodejs";

function publicUser(user: {
  firstName: string;
  lastName: string;
  profileImageUrl: string;
}) {
  return {
    firstName: user.firstName,
    lastName: user.lastName,
    profileImageUrl: user.profileImageUrl ?? "",
  };
}

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
    if (!user) {
      return NextResponse.json({ authenticated: false });
    }
    return NextResponse.json({
      authenticated: true,
      ...publicUser(user),
    });
  } catch (error) {
    console.error("me lookup failed", error);
    return NextResponse.json(
      { authenticated: false, error: "Could not look up the current user." },
      { status: 503 },
    );
  }
}

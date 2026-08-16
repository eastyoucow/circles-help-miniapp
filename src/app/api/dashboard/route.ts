import { NextResponse } from "next/server";
import { authenticateRequest } from "@/lib/auth/request-user";
import {
  findUserByTelegramId,
  listUsersByActivityCount,
} from "@/lib/db/users";

export const runtime = "nodejs";

export async function GET(request: Request) {
  const auth = authenticateRequest(request);
  if (!auth.ok) {
    return NextResponse.json(
      { error: "Sign in from Telegram or link Strava first." },
      { status: 401 },
    );
  }

  try {
    const user = await findUserByTelegramId(auth.telegramUserId);
    if (!user) {
      return NextResponse.json(
        { error: "Strava is not connected." },
        { status: 404 },
      );
    }

    const users = await listUsersByActivityCount();
    const meRow = users.find((row) => row.id === user.id);
    const me = {
      firstName: user.firstName,
      lastName: user.lastName,
      profileImageUrl: user.profileImageUrl ?? "",
      activityCount: meRow?.activityCount ?? 0,
    };

    return NextResponse.json({
      me,
      users: users.map((row) => ({
        firstName: row.firstName,
        lastName: row.lastName,
        profileImageUrl: row.profileImageUrl,
        activityCount: row.activityCount,
        isCurrentUser: row.id === user.id,
      })),
    });
  } catch (error) {
    console.error("dashboard lookup failed", error);
    return NextResponse.json(
      { error: "Could not load the dashboard." },
      { status: 503 },
    );
  }
}

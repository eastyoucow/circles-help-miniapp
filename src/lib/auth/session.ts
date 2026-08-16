import { createHmac, timingSafeEqual } from "node:crypto";
import { optionalEnv, requiredEnv } from "@/lib/env";

export const SESSION_COOKIE_NAME = "ch_session";
const SESSION_TTL_SECONDS = 60 * 60 * 24 * 7;

type SessionPayload = {
  t: string;
  e: number;
};

function getSessionSecret(): string {
  return optionalEnv("OAUTH_STATE_SECRET") ?? requiredEnv("TOKEN_ENCRYPTION_KEY");
}

function sign(payload: string): string {
  return createHmac("sha256", getSessionSecret())
    .update(payload)
    .digest("base64url");
}

function signaturesEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function createSessionValue(telegramUserId: string): string {
  const payload: SessionPayload = {
    t: telegramUserId,
    e: Date.now() + SESSION_TTL_SECONDS * 1000,
  };
  const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString(
    "base64url",
  );
  return `${encoded}.${sign(encoded)}`;
}

export function readSessionTelegramUserId(value: string | undefined): string | null {
  if (!value) {
    return null;
  }

  const [encoded, signature] = value.split(".");
  if (!encoded || !signature || !signaturesEqual(sign(encoded), signature)) {
    return null;
  }

  try {
    const payload = JSON.parse(
      Buffer.from(encoded, "base64url").toString("utf8"),
    ) as SessionPayload;
    if (!payload.t || payload.e < Date.now()) {
      return null;
    }
    return payload.t;
  } catch {
    return null;
  }
}

export function readSessionCookie(request: Request): string | null {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) {
    return null;
  }

  for (const part of cookieHeader.split(";")) {
    const [name, ...rest] = part.trim().split("=");
    if (name === SESSION_COOKIE_NAME) {
      return readSessionTelegramUserId(decodeURIComponent(rest.join("=")));
    }
  }

  return null;
}

export function sessionCookieOptions() {
  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax" as const,
    path: "/",
    maxAge: SESSION_TTL_SECONDS,
  };
}

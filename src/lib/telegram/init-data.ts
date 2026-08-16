import { createHmac, timingSafeEqual } from "node:crypto";
import { requiredEnv } from "@/lib/env";

const MAX_AUTH_AGE_SECONDS = 60 * 60;

export type TelegramWebAppUser = {
  id: number;
  first_name?: string;
  last_name?: string;
  username?: string;
};

function getBotToken(): string {
  return requiredEnv("TELEGRAM_BOT_TOKEN");
}

function hexEqual(left: string, right: string): boolean {
  const a = Buffer.from(left, "hex");
  const b = Buffer.from(right, "hex");
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

export function verifyTelegramInitData(initData: string): TelegramWebAppUser {
  const params = new URLSearchParams(initData);
  const receivedHash = params.get("hash");
  if (!receivedHash) {
    throw new Error("Telegram initData is missing hash.");
  }

  params.delete("hash");
  const dataCheckString = [...params.entries()]
    .map(([key, value]) => `${key}=${value}`)
    .sort()
    .join("\n");

  const secretKey = createHmac("sha256", "WebAppData")
    .update(getBotToken())
    .digest();
  const computedHash = createHmac("sha256", secretKey)
    .update(dataCheckString)
    .digest("hex");

  if (!hexEqual(computedHash, receivedHash)) {
    throw new Error("Telegram initData hash is invalid.");
  }

  const authDateRaw = params.get("auth_date");
  const authDate = authDateRaw ? Number(authDateRaw) : NaN;
  if (!Number.isFinite(authDate)) {
    throw new Error("Telegram initData auth_date is invalid.");
  }

  const ageSeconds = Date.now() / 1000 - authDate;
  if (ageSeconds > MAX_AUTH_AGE_SECONDS || ageSeconds < -60) {
    throw new Error("Telegram initData has expired.");
  }

  const userRaw = params.get("user");
  if (!userRaw) {
    throw new Error("Telegram initData is missing user.");
  }

  const user = JSON.parse(userRaw) as TelegramWebAppUser;
  if (!user?.id || typeof user.id !== "number") {
    throw new Error("Telegram initData user id is invalid.");
  }

  return user;
}

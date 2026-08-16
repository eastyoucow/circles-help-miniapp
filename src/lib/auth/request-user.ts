import { readSessionCookie } from "@/lib/auth/session";
import { readTelegramInitData } from "@/lib/telegram/read-init-data";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

export type RequestAuth =
  | { ok: true; telegramUserId: string }
  | { ok: false; reason: "missing" | "invalid" };

export function authenticateRequest(
  request: Request,
  body?: unknown,
): RequestAuth {
  const initData = readTelegramInitData(request, body);
  if (initData) {
    try {
      return {
        ok: true,
        telegramUserId: String(verifyTelegramInitData(initData).id),
      };
    } catch {
      return { ok: false, reason: "invalid" };
    }
  }

  const fromCookie = readSessionCookie(request);
  if (fromCookie) {
    return { ok: true, telegramUserId: fromCookie };
  }

  return { ok: false, reason: "missing" };
}

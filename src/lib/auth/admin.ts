import { timingSafeEqual } from "node:crypto";
import { optionalEnv } from "@/lib/env";
import { readTelegramInitData } from "@/lib/telegram/read-init-data";
import { verifyTelegramInitData } from "@/lib/telegram/init-data";

export type AdminAuth =
  | { ok: true }
  | { ok: false; status: 401 | 403 | 503; error: string };

function secretsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function readAdminSecret(request: Request): string | null {
  const header = request.headers.get("x-admin-secret")?.trim();
  if (header) {
    return header;
  }

  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    return token || null;
  }

  return null;
}

export function authenticateAdmin(
  request: Request,
  body?: unknown,
): AdminAuth {
  const adminSecret = optionalEnv("ADMIN_SECRET");
  const adminTelegramUserId = optionalEnv("ADMIN_TELEGRAM_USER_ID");
  if (!adminSecret && !adminTelegramUserId) {
    return {
      ok: false,
      status: 503,
      error: "Admin access is not configured.",
    };
  }

  if (adminSecret) {
    const provided = readAdminSecret(request);
    if (provided && secretsEqual(provided, adminSecret)) {
      return { ok: true };
    }
  }

  if (adminTelegramUserId) {
    const initData = readTelegramInitData(request, body);
    if (!initData) {
      return {
        ok: false,
        status: 401,
        error: "Admin authentication is required.",
      };
    }
    try {
      const telegramUserId = String(verifyTelegramInitData(initData).id);
      if (telegramUserId === adminTelegramUserId) {
        return { ok: true };
      }
      return { ok: false, status: 403, error: "Admin access is denied." };
    } catch {
      return { ok: false, status: 401, error: "Admin authentication is invalid." };
    }
  }

  return {
    ok: false,
    status: 401,
    error: "Admin authentication is required.",
  };
}

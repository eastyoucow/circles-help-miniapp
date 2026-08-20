import { timingSafeEqual } from "node:crypto";
import { optionalEnv } from "@/lib/env";

export type CronAuth =
  | { ok: true }
  | { ok: false; status: 401 | 503; error: string };

function secretsEqual(left: string, right: string): boolean {
  const a = Buffer.from(left);
  const b = Buffer.from(right);
  if (a.length === 0 || a.length !== b.length) {
    return false;
  }
  return timingSafeEqual(a, b);
}

function readBearer(request: Request): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("bearer ")) {
    const token = authorization.slice(7).trim();
    return token || null;
  }
  return null;
}

export function authenticateCron(request: Request): CronAuth {
  const cronSecret = optionalEnv("CRON_SECRET");
  const adminSecret = optionalEnv("ADMIN_SECRET");
  if (!cronSecret && !adminSecret) {
    return {
      ok: false,
      status: 503,
      error: "Cron access is not configured.",
    };
  }

  const bearer = readBearer(request);
  const adminHeader = request.headers.get("x-admin-secret")?.trim() || null;

  if (cronSecret && bearer && secretsEqual(bearer, cronSecret)) {
    return { ok: true };
  }

  if (adminSecret) {
    if (bearer && secretsEqual(bearer, adminSecret)) {
      return { ok: true };
    }
    if (adminHeader && secretsEqual(adminHeader, adminSecret)) {
      return { ok: true };
    }
  }

  return {
    ok: false,
    status: 401,
    error: "Cron authentication is required.",
  };
}

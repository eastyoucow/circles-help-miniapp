"use client";

export function getTelegramInitData(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.Telegram?.WebApp?.initData?.trim() ?? "";
}

export function readyTelegramWebApp(): void {
  window.Telegram?.WebApp?.ready();
  window.Telegram?.WebApp?.expand();
}

export function telegramAuthHeaders(): HeadersInit {
  const initData = getTelegramInitData();
  const headers: Record<string, string> = {};
  if (initData) {
    headers.Authorization = `tma ${initData}`;
  }
  return headers;
}

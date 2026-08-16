export function readTelegramInitData(
  request: Request,
  body?: unknown,
): string | null {
  const authorization = request.headers.get("authorization");
  if (authorization?.toLowerCase().startsWith("tma ")) {
    const fromHeader = authorization.slice(4).trim();
    if (fromHeader) {
      return fromHeader;
    }
  }

  if (body && typeof body === "object" && "initData" in body) {
    const initData = (body as { initData?: unknown }).initData;
    if (typeof initData === "string" && initData.trim()) {
      return initData.trim();
    }
  }

  return null;
}

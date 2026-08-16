"use client";

import { useEffect, useState } from "react";
import styles from "./page.module.css";

function getTelegramInitData(): string {
  if (typeof window === "undefined") {
    return "";
  }
  return window.Telegram?.WebApp?.initData?.trim() ?? "";
}

export function LinkStravaButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    window.Telegram?.WebApp?.ready();
    window.Telegram?.WebApp?.expand();
  }, []);

  async function onClick() {
    setError(null);
    const initData = getTelegramInitData();
    if (!initData) {
      setError("Open Circles Help in Telegram to link Strava.");
      return;
    }

    setPending(true);
    try {
      const response = await fetch("/api/strava/oauth/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData }),
      });
      const body = (await response.json()) as {
        authorizeUrl?: string;
        error?: string;
      };

      if (!response.ok || !body.authorizeUrl) {
        setError(body.error ?? "Could not start Strava authorization.");
        return;
      }

      window.location.href = body.authorizeUrl;
    } catch {
      setError("Could not start Strava authorization.");
    } finally {
      setPending(false);
    }
  }

  return (
    <>
      <button
        type="button"
        className={`${styles.button} ${styles.strava}`}
        onClick={onClick}
        disabled={pending}
      >
        {pending ? "Connecting…" : "Link Strava"}
      </button>
      {error ? <p className={styles.statusError}>{error}</p> : null}
    </>
  );
}

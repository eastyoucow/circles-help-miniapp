"use client";

import { useState } from "react";
import styles from "./page.module.css";
import { getTelegramInitData } from "./telegram-web-app";

export function LinkStravaButton() {
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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

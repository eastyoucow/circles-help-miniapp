"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LinkStravaButton } from "./LinkStravaButton";
import styles from "./page.module.css";
import { readyTelegramWebApp, telegramAuthHeaders } from "./telegram-web-app";

type HomeActionsProps = {
  status?: { text: string; ok: boolean };
  donateUrl: string;
  aboutUrl: string;
};

export function HomeActions({ status, donateUrl, aboutUrl }: HomeActionsProps) {
  const [connected, setConnected] = useState<boolean | null>(null);

  useEffect(() => {
    readyTelegramWebApp();

    let cancelled = false;
    async function loadMe() {
      try {
        const response = await fetch("/api/me", {
          headers: telegramAuthHeaders(),
          credentials: "include",
          cache: "no-store",
        });
        const body = (await response.json()) as { authenticated?: boolean };
        if (!cancelled) {
          setConnected(Boolean(response.ok && body.authenticated));
        }
      } catch {
        if (!cancelled) {
          setConnected(false);
        }
      }
    }

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className={styles.actions}>
      {status ? (
        <p className={status.ok ? styles.statusOk : styles.statusError}>
          {status.text}
        </p>
      ) : null}
      {connected === null ? (
        <button
          type="button"
          className={`${styles.button} ${styles.strava}`}
          disabled
        >
          Loading…
        </button>
      ) : connected ? (
        <Link href="/stats" className={`${styles.button} ${styles.strava}`}>
          My Stats
        </Link>
      ) : (
        <LinkStravaButton />
      )}
      <a
        className={`${styles.button} ${styles.donate}`}
        href={donateUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        Donate
      </a>
      <a
        className={styles.about}
        href={aboutUrl}
        target="_blank"
        rel="noopener noreferrer"
      >
        About us
      </a>
    </div>
  );
}

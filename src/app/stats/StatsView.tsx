"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { readyTelegramWebApp, telegramAuthHeaders } from "../telegram-web-app";
import styles from "./stats.module.css";

type Athlete = {
  firstname: string;
  lastname: string;
  profile: string;
};

export function StatsView() {
  const [athlete, setAthlete] = useState<Athlete | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readyTelegramWebApp();

    let cancelled = false;
    async function loadAthlete() {
      try {
        const response = await fetch("/api/athlete", {
          headers: telegramAuthHeaders(),
          credentials: "include",
          cache: "no-store",
        });
        const body = (await response.json()) as Athlete & { error?: string };
        if (cancelled) {
          return;
        }
        if (!response.ok) {
          setError(body.error ?? "Could not load your Strava profile.");
          return;
        }
        setAthlete({
          firstname: body.firstname,
          lastname: body.lastname,
          profile: body.profile,
        });
      } catch {
        if (!cancelled) {
          setError("Could not load your Strava profile.");
        }
      }
    }

    void loadAthlete();
    return () => {
      cancelled = true;
    };
  }, []);

  const displayName = athlete
    ? [athlete.firstname, athlete.lastname].filter(Boolean).join(" ")
    : "Loading…";
  const initials = athlete
    ? `${athlete.firstname.charAt(0)}${athlete.lastname.charAt(0)}`.toUpperCase()
    : "";

  return (
    <main className={styles.main}>
      <h1 className={styles.name}>{displayName}</h1>
      {athlete?.profile ? (
        // Strava CDN hosts vary; a plain img avoids next/image remote allowlists.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          className={styles.photo}
          src={athlete.profile}
          alt={`${displayName} Strava profile photo`}
          width={160}
          height={160}
        />
      ) : athlete ? (
        <div className={`${styles.photo} ${styles.photoFallback}`} aria-hidden>
          {initials || "?"}
        </div>
      ) : (
        <div className={styles.photo} aria-hidden />
      )}
      {error ? <p className={styles.error}>{error}</p> : null}
      <Link href="/" className={styles.home}>
        Back to Circles Help
      </Link>
    </main>
  );
}

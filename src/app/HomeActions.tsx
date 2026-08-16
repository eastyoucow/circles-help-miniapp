"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { LinkStravaButton } from "./LinkStravaButton";
import { UserAvatar } from "./UserAvatar";
import styles from "./page.module.css";
import { readyTelegramWebApp, telegramAuthHeaders } from "./telegram-web-app";

type HomeActionsProps = {
  status?: { text: string; ok: boolean };
  donateUrl: string;
  aboutUrl: string;
};

type MeProfile = {
  firstName: string;
  lastName: string;
  profileImageUrl: string;
};

export function HomeActions({ status, donateUrl, aboutUrl }: HomeActionsProps) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [me, setMe] = useState<MeProfile | null>(null);

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
        const body = (await response.json()) as {
          authenticated?: boolean;
          firstName?: string;
          lastName?: string;
          profileImageUrl?: string;
        };
        if (cancelled) {
          return;
        }
        if (response.ok && body.authenticated) {
          setConnected(true);
          setMe({
            firstName: body.firstName ?? "",
            lastName: body.lastName ?? "",
            profileImageUrl: body.profileImageUrl ?? "",
          });
        } else {
          setConnected(false);
          setMe(null);
        }
      } catch {
        if (!cancelled) {
          setConnected(false);
          setMe(null);
        }
      }
    }

    void loadMe();
    return () => {
      cancelled = true;
    };
  }, []);

  const chipName = me
    ? [me.firstName, me.lastName].filter(Boolean).join(" ")
    : "";

  return (
    <>
      {me ? (
        <Link
          href="/dashboard"
          className={styles.userChip}
          aria-label={`${chipName} dashboard`}
        >
          <UserAvatar
            className={styles.userChipPhoto}
            src={me.profileImageUrl}
            name={chipName}
            size={28}
          />
          <span className={styles.userChipName}>
            {me.firstName || chipName}
          </span>
        </Link>
      ) : null}
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
          <Link href="/dashboard" className={`${styles.button} ${styles.strava}`}>
            Dashboard
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
    </>
  );
}

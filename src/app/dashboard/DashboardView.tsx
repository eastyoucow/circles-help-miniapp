"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { UserAvatar } from "../UserAvatar";
import { readyTelegramWebApp, telegramAuthHeaders } from "../telegram-web-app";
import styles from "./dashboard.module.css";

type DashboardUser = {
  firstName: string;
  lastName: string;
  profileImageUrl: string;
  activityCount: number;
  isCurrentUser?: boolean;
};

type DashboardData = {
  me: DashboardUser;
  users: DashboardUser[];
};

export function DashboardView() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    readyTelegramWebApp();

    let cancelled = false;
    async function loadDashboard() {
      try {
        const response = await fetch("/api/dashboard", {
          headers: telegramAuthHeaders(),
          credentials: "include",
          cache: "no-store",
        });
        const body = (await response.json()) as DashboardData & {
          error?: string;
        };
        if (cancelled) {
          return;
        }
        if (!response.ok || !body.me) {
          setError(body.error ?? "Could not load the dashboard.");
          return;
        }
        setData({ me: body.me, users: body.users ?? [] });
      } catch {
        if (!cancelled) {
          setError("Could not load the dashboard.");
        }
      }
    }

    void loadDashboard();
    return () => {
      cancelled = true;
    };
  }, []);

  if (error && !data) {
    return (
      <main className={styles.main}>
        <p className={styles.error}>{error}</p>
        <Link href="/" className={styles.home}>
          Back to Circles Help
        </Link>
      </main>
    );
  }

  const meName = data
    ? [data.me.firstName, data.me.lastName].filter(Boolean).join(" ")
    : "Loading…";

  return (
    <main className={styles.main}>
      <section className={styles.profile} aria-label="Your stats">
        <UserAvatar
          className={styles.photo}
          src={data?.me.profileImageUrl ?? ""}
          name={meName}
          size={96}
        />
        <h1 className={styles.name}>{data?.me.firstName ?? "Loading…"}</h1>
        {data?.me.lastName ? (
          <p className={styles.surname}>{data.me.lastName}</p>
        ) : null}
        {data ? (
          <p className={styles.count}>
            {data.me.activityCount}{" "}
            {data.me.activityCount === 1 ? "activity" : "activities"}
          </p>
        ) : null}
      </section>

      <h2 className={styles.heading}>All athletes</h2>
      <div className={styles.tableWrap}>
        <table className={styles.table}>
          <thead>
            <tr>
              <th className={styles.photoCell}> </th>
              <th>Name</th>
              <th>Surname</th>
              <th className={styles.num}>Activities</th>
            </tr>
          </thead>
          <tbody>
            {(data?.users ?? []).map((row, index) => {
              const rowName = [row.firstName, row.lastName]
                .filter(Boolean)
                .join(" ");
              return (
                <tr
                  key={`${row.firstName}-${row.lastName}-${index}`}
                  className={row.isCurrentUser ? styles.currentRow : undefined}
                >
                  <td className={styles.photoCell}>
                    <UserAvatar
                      className={styles.rowPhoto}
                      src={row.profileImageUrl}
                      name={rowName}
                      size={32}
                    />
                  </td>
                  <td>{row.firstName}</td>
                  <td>{row.lastName}</td>
                  <td className={styles.num}>{row.activityCount}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <Link href="/" className={styles.home}>
        Back to Circles Help
      </Link>
    </main>
  );
}

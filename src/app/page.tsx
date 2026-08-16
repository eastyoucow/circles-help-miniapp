import Image from "next/image";
import { HomeActions } from "./HomeActions";
import styles from "./page.module.css";

const DONATE_URL =
  "https://payments.evoca.am/en/redirect/06B9FD02-032D-4956-A0A3-A2ED9352C409?v3=1660078599694900&a=0";
const ABOUT_URL = "https://lc.cx/circles-help";

const STRAVA_STATUS: Record<string, { text: string; ok: boolean }> = {
  connected: { text: "Strava is connected.", ok: true },
  denied: { text: "Strava authorization was cancelled.", ok: false },
  invalid_state: {
    text: "The authorization session expired. Try again.",
    ok: false,
  },
  token_exchange: {
    text: "Strava did not return tokens. Try again.",
    ok: false,
  },
  conflict: {
    text: "That Strava account is already linked to another user.",
    ok: false,
  },
  missing_code: {
    text: "Strava did not return an authorization code.",
    ok: false,
  },
  config: {
    text: "Server is missing Strava or encryption settings.",
    ok: false,
  },
  database: {
    text: "Could not reach the database. Check Supabase connection settings.",
    ok: false,
  },
  server: { text: "Could not save the Strava connection. Try again.", ok: false },
};

type HomeProps = {
  searchParams: Promise<{ strava?: string }>;
};

export default async function Home({ searchParams }: HomeProps) {
  const params = await searchParams;
  const status = params.strava ? STRAVA_STATUS[params.strava] : undefined;

  return (
    <main className={styles.main}>
      <h1 className={styles.srOnly}>Circles Help</h1>
      <Image
        src="/circles-help-logo.png"
        alt="Circles Help logo featuring a navy blue silhouette of a person with raised arms inside a brushstroke circle, with a red heart at the bottom-right and the project name in arched text."
        width={1024}
        height={1024}
        className={styles.logo}
        priority
      />
      <HomeActions
        status={status}
        donateUrl={DONATE_URL}
        aboutUrl={ABOUT_URL}
      />
    </main>
  );
}

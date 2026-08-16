import Image from "next/image";
import styles from "./page.module.css";

const DONATE_URL =
  "https://payments.evoca.am/en/redirect/06B9FD02-032D-4956-A0A3-A2ED9352C409?v3=1660078599694900&a=0";
const ABOUT_URL = "https://lc.cx/circles-help";

export default function Home() {
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
      <div className={styles.actions}>
        <button type="button" className={`${styles.button} ${styles.strava}`}>
          Link Strava
        </button>
        <a
          className={`${styles.button} ${styles.donate}`}
          href={DONATE_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          Donate
        </a>
        <a
          className={styles.about}
          href={ABOUT_URL}
          target="_blank"
          rel="noopener noreferrer"
        >
          About us
        </a>
      </div>
    </main>
  );
}

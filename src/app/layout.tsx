import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Circles Help",
  description: "Telegram Mini App for the Circles Help channel",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata } from "next";
import { DashboardView } from "./DashboardView";

export const metadata: Metadata = {
  title: "Dashboard · Circles Help",
};

export default function DashboardPage() {
  return <DashboardView />;
}

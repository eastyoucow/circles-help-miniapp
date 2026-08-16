import type { Metadata } from "next";
import { StatsView } from "./StatsView";

export const metadata: Metadata = {
  title: "My Stats · Circles Help",
};

export default function StatsPage() {
  return <StatsView />;
}

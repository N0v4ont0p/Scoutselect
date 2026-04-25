import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "How It Works",
  description:
    "How ScoutSelect computes OPR, alliance role detection, pick-list rankings, synergy scores, and Monte Carlo win probability for FTC teams.",
  alternates: { canonical: "/methodology" },
};

export default function MethodologyLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

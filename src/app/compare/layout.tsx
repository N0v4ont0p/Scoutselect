import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Compare Teams",
  description:
    "Side-by-side comparison of FTC team OPR, Auto/Teleop/Endgame contributions, and reliability for any event. Paste an event code to start.",
  alternates: { canonical: "/compare" },
};

export default function CompareLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

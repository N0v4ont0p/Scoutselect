import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Team Search",
  description:
    "Search any FIRST Tech Challenge team by number or name. View team details and navigate to event-level alliance selection analysis.",
  alternates: { canonical: "/teams" },
};

export default function TeamsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

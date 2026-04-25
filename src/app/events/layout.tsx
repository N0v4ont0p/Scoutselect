import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Event Analysis",
  description:
    "Enter your FTC team number to find your events and open full alliance selection analysis — pick list, win probability, and pitch strategy.",
  alternates: { canonical: "/events" },
};

export default function EventsLayout({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

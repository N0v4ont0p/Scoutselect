import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import { LanguageProvider } from "@/context/LanguageContext";
import Navbar from "@/components/Navbar";
import LangSync from "@/components/LangSync";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

const SITE_URL = "https://scoutselect.org";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "ScoutSelect — FTC Alliance Selection Tool",
    template: "%s | ScoutSelect",
  },
  description:
    "Free FTC alliance selection tool for drive coaches and scouters. Look up teams, analyze events, build pick lists, and model win probability — powered by FTCScout data.",
  keywords: [
    "FTC alliance selection",
    "FTC scouting tool",
    "FTC pick list",
    "FTC team comparison",
    "FTC event analysis",
    "FIRST Tech Challenge analytics",
    "FTC OPR",
    "FTC win probability",
  ],
  authors: [{ name: "FTC Team 19859" }],
  alternates: {
    canonical: "/",
  },
  openGraph: {
    type: "website",
    url: SITE_URL,
    siteName: "ScoutSelect",
    title: "ScoutSelect — FTC Alliance Selection Tool",
    description:
      "Free FTC alliance selection tool for drive coaches and scouters. Look up teams, analyze events, build pick lists, and model win probability.",
  },
  twitter: {
    card: "summary_large_image",
    title: "ScoutSelect — FTC Alliance Selection Tool",
    description:
      "Free FTC alliance selection tool. Team lookup, event analysis, pick list builder, win probability — powered by FTCScout.",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <LanguageProvider>
          <LangSync />
          <Navbar />
          {children}
        </LanguageProvider>
      </body>
    </html>
  );
}

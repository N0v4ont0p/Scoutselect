import type { Metadata } from 'next';
import localFont from 'next/font/local';
import './globals.css';

const geist = localFont({
  src: './fonts/GeistVF.woff',
  variable: '--font-geist',
});

export const metadata: Metadata = {
  title: 'ScoutSelect — FTC Alliance Intelligence',
  description: 'Data-driven alliance selection, OPR analytics, and Monte Carlo simulation for FTC teams',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="dark">
      <body className={`${geist.className} min-h-screen bg-background text-foreground`}>{children}</body>
    </html>
  );
}

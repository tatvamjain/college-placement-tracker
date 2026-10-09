import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, JetBrains_Mono } from "next/font/google";
import { Suspense } from "react";

import { SiteHeader } from "@/components/SiteHeader";
import { Ticker } from "@/components/Ticker";

import "./globals.css";

const display = Bricolage_Grotesque({
  variable: "--font-display",
  subsets: ["latin"],
});

const board = JetBrains_Mono({
  variable: "--font-board",
  subsets: ["latin"],
});

// Link previews need absolute image URLs. SITE_URL is passed in at build time (see the Dockerfile).
export const metadata: Metadata = {
  metadataBase: new URL(process.env.SITE_URL ?? "http://localhost:3000"),
  applicationName: "Placement Board",
  appleWebApp: { title: "Placements", statusBarStyle: "black-translucent" },
  openGraph: { siteName: "Placement Board", type: "website" },
  twitter: { card: "summary_large_image" },
  title: {
    default: "Placement Board",
    template: "%s · Placement Board",
  },
  description:
    "Live campus placements: which companies are visiting, today's rounds, packages and results.",
};

export const viewport: Viewport = {
  themeColor: "#0a0c0f",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${display.variable} ${board.variable} antialiased`}>
      <body>
        <SiteHeader />
        <Suspense fallback={<div className="ticker" aria-hidden />}>
          <Ticker />
        </Suspense>
        <div className="shell">{children}</div>
        <footer className="site-footer">
          <div className="shell">
            THIS IS A STUDENT HELD WEBSITE · DATA MIGHT BE INACCURATE · PACKAGES IN LAKHS PER ANNUM · TIMES IN IST
          </div>
        </footer>
      </body>
    </html>
  );
}

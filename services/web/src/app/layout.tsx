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

export const metadata: Metadata = {
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
            DATA FROM THE PLACEMENT CELL · PACKAGES IN LAKHS PER ANNUM · TIMES IN IST
          </div>
        </footer>
      </body>
    </html>
  );
}

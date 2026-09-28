import type { Metadata } from "next";
import { IBM_Plex_Sans, IBM_Plex_Sans_Condensed } from "next/font/google";
import "./globals.css";

const plex = IBM_Plex_Sans({
  variable: "--font-plex",
  subsets: ["latin", "latin-ext"],
  weight: ["400", "500", "600", "700"],
});

const plexCond = IBM_Plex_Sans_Condensed({
  variable: "--font-plex-cond",
  subsets: ["latin", "latin-ext"],
  weight: ["500", "600", "700"],
});

export const metadata: Metadata = {
  title: "SR Reporting",
  description: "SR Auto — satış, bazar payı və stok hesabatları",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="az" className={`${plex.variable} ${plexCond.variable}`}>
      <body>{children}</body>
    </html>
  );
}

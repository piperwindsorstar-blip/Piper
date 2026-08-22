import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Piper — Wedding DJ CRM",
  description: "Events, calendar, music and timeline planning for wedding DJ teams",
  // Belt and braces with robots.ts. Every page here is either behind a login
  // or reachable only by a link somebody was given; none of it belongs in a
  // search index.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Piper — Wedding DJ CRM",
  description: "Weddings, calendar, music and timeline planning for wedding DJ teams",
  // Belt and braces with robots.ts. Every page here is either behind a login
  // or reachable only by a link somebody was given; none of it belongs in a
  // search index.
  robots: { index: false, follow: false },
  applicationName: "PYNX Dispatch",
  appleWebApp: {
    capable: true,
    title: "Dispatch",
    // The board's own background, so the status bar does not flash white on
    // launch before the page paints.
    statusBarStyle: "default",
  },
  icons: {
    icon: [{ url: "/icon-192.png", sizes: "192x192", type: "image/png" }],
    apple: [{ url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" }],
  },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f5f4f8" },
    { media: "(prefers-color-scheme: dark)", color: "#100f14" },
  ],
  // Installed apps sit under the notch and over the home indicator on a phone;
  // without this the page draws into both.
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

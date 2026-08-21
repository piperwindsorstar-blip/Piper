import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Piper — Wedding DJ CRM",
  description: "Events, calendar, music and timeline planning for wedding DJ teams",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}

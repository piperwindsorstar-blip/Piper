"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export default function EventTabs({ eventId }: { eventId: number }) {
  const pathname = usePathname();
  const base = `/events/${eventId}`;
  const tabs = [
    { href: base, label: "Overview" },
    { href: `${base}/music`, label: "Music" },
    { href: `${base}/timeline`, label: "Timeline" },
    { href: `${base}/day-of`, label: "Day-of sheet" },
  ];

  return (
    <nav className="tabs">
      {tabs.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

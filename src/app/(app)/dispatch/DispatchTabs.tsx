"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/dispatch", label: "Board" },
  { href: "/dispatch/gantt", label: "Gantt" },
  { href: "/dispatch/vehicles", label: "Fleet" },
  { href: "/dispatch/history", label: "Who drove" },
];

export default function DispatchTabs() {
  const pathname = usePathname();

  return (
    <nav className="tabs">
      {TABS.map((tab) => (
        <Link key={tab.href} href={tab.href} aria-current={pathname === tab.href ? "page" : undefined}>
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

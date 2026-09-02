"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";

const TABS = [
  { href: "/dispatch", label: "Board" },
  { href: "/dispatch/gantt", label: "Gantt" },
  { href: "/dispatch/vehicles", label: "Fleet" },
  { href: "/dispatch/history", label: "Who drove" },
];

export default function DispatchTabs() {
  const pathname = usePathname();
  const search = useSearchParams();

  // Carried between the tabs, or the side menu reappears on the second click
  // and the whole point of the separate address is lost.
  const focus = search.get("focus") === "dispatch" ? "?focus=dispatch" : "";

  return (
    <nav className="tabs">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={`${tab.href}${focus}`}
          aria-current={pathname === tab.href ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

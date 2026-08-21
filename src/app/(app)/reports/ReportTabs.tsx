"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/reports", label: "Matched" },
  { href: "/reports/dj", label: "DJ Reports" },
  { href: "/reports/warehouse", label: "Warehouse" },
  { href: "/reports/crew", label: "Crew Stats" },
  { href: "/reports/quality", label: "Quality" },
  { href: "/reports/aliases", label: "Aliases" },
  { href: "/reports/test", label: "Test Entries" },
];

export default function ReportTabs() {
  const pathname = usePathname();

  return (
    <nav className="tabs">
      {TABS.map((tab) => (
        <Link
          key={tab.href}
          href={tab.href}
          aria-current={pathname === tab.href ? "page" : undefined}
          className={tab.href === "/reports/test" ? "faint" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

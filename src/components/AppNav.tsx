"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/login/actions";

export type NavItem = { href: string; label: string };

type Props = {
  main: NavItem[];
  admin: NavItem[];
  user: { name: string; role: string };
};

export default function AppNav({ main, admin, user }: Props) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);

  // On phones the menu overlays the page, so close it once navigation lands.
  useEffect(() => setOpen(false), [pathname]);

  const link = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
        {item.label}
      </Link>
    );
  };

  return (
    <aside className={`sidebar${open ? " open" : ""}`}>
      <div className="sidebar-top">
        <div className="brand">
          <span className="brand-mark">P</span>
          <span className="brand-name">Piper</span>
        </div>
        <button
          type="button"
          className="nav-toggle"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="app-nav"
        >
          <span aria-hidden="true">{open ? "✕" : "☰"}</span>
          <span className="sr-only">{open ? "Close menu" : "Open menu"}</span>
        </button>
      </div>

      <div className="sidebar-panel" id="app-nav">
        <nav className="nav">
          {main.map(link)}
          {admin.length > 0 && (
            <>
              <span className="nav-label">Admin</span>
              {admin.map(link)}
            </>
          )}
        </nav>

        <div className="sidebar-foot">
          <div className="who">
            <div className="who-name">{user.name}</div>
            <div className="who-role">{user.role === "admin" ? "Admin" : "DJ"}</div>
          </div>
          <form action={logout}>
            <button className="btn btn-sm" type="submit" style={{ width: "100%" }}>
              Sign out
            </button>
          </form>
        </div>
      </div>
    </aside>
  );
}

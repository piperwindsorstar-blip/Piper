"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { logout } from "@/app/login/actions";
import Icon, { type IconName } from "./Icon";

export type NavItem = { href: string; label: string; icon: IconName };

type Props = {
  main: NavItem[];
  admin: NavItem[];
  user: { name: string; role: string };
};

export default function AppNav({ main, admin, user }: Props) {
  const pathname = usePathname();
  const search = useSearchParams();

  /*
   * dispatch.djpynxpro.com is this app with the rest of it out of the way.
   *
   * That address redirects to /dispatch?focus=dispatch, and the whole of the
   * side menu goes: somebody sent to the board to see where a van is should
   * not be one mis-tap from the outbox or the staff list. It is the same app
   * and the same session — .shell is a flex row, so with the nav gone the
   * board simply takes the full width.
   *
   * Deliberately a query parameter and not a cookie. A cookie would follow
   * them to crm.djpynxpro.com and hide the menu there too, and the way out of
   * that is not obvious from a page with no navigation on it. Here, editing
   * the address bar is the way out, and the tabs carry the flag so it survives
   * moving between Board, Gantt and Fleet.
   */
  if (search.get("focus") === "dispatch") return null;
  const [open, setOpen] = useState(false);

  // On phones the menu overlays the page, so close it once navigation lands.
  useEffect(() => setOpen(false), [pathname]);

  const link = (item: NavItem) => {
    const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
    return (
      <Link key={item.href} href={item.href} aria-current={active ? "page" : undefined}>
        <Icon name={item.icon} size={17} />
        <span>{item.label}</span>
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
          <Icon name={open ? "close" : "dashboard"} size={17} />
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

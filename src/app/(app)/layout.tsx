import { requireUser } from "@/lib/auth";
import { logout } from "../login/actions";
import NavLinks, { type NavItem } from "@/components/NavLinks";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const main: NavItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/calendar", label: "Calendar" },
    { href: "/events", label: "Events" },
  ];
  const admin: NavItem[] = [
    { href: "/venues", label: "Venues" },
    { href: "/team", label: "Team" },
  ];

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-mark">P</span>
          <span className="brand-name">Piper</span>
        </div>

        <nav className="nav">
          <NavLinks items={main} />
          {user.role === "admin" && (
            <>
              <span className="nav-label">Admin</span>
              <NavLinks items={admin} />
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
      </aside>

      <div className="main">{children}</div>
    </div>
  );
}

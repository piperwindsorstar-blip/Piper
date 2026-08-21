import { requireUser } from "@/lib/auth";
import AppNav, { type NavItem } from "@/components/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const main: NavItem[] = [
    { href: "/dashboard", label: "Dashboard" },
    { href: "/calendar", label: "Calendar" },
    { href: "/events", label: "Events" },
    { href: "/me", label: "My page" },
  ];
  const admin: NavItem[] =
    user.role === "admin"
      ? [
          { href: "/reports", label: "Crew Reports" },
          { href: "/venues", label: "Venues" },
          { href: "/team", label: "Staff" },
        ]
      : [];

  return (
    <div className="shell">
      <AppNav main={main} admin={admin} user={{ name: user.name, role: user.role }} />
      <div className="main">{children}</div>
    </div>
  );
}

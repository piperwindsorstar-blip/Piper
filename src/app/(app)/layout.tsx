import { requireUser } from "@/lib/auth";
import AppNav, { type NavItem } from "@/components/AppNav";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();

  const main: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    { href: "/calendar", label: "Calendar", icon: "calendar" },
    { href: "/events", label: "Weddings", icon: "events" },
    { href: "/me", label: "My page", icon: "person" },
  ];
  const admin: NavItem[] =
    user.role === "admin"
      ? [
          { href: "/reports", label: "Crew Reports", icon: "clipboard" },
          { href: "/venues", label: "Venues", icon: "pin" },
          { href: "/dispatch", label: "Dispatch", icon: "truck" },
          { href: "/rentals", label: "Rentals", icon: "key" },
          { href: "/team", label: "Staff", icon: "people" },
          { href: "/outbox", label: "Outbox", icon: "mail" },
          { href: "/activity", label: "Activity", icon: "activity" },
          { href: "/settings", label: "Settings", icon: "settings" },
        ]
      : [];

  return (
    <div className="shell">
      <AppNav main={main} admin={admin} user={{ name: user.name, role: user.role }} />
      <div className="main">{children}</div>
    </div>
  );
}

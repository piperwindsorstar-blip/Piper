import { requireUser } from "@/lib/auth";
import { permissionsFor } from "@/lib/permissions";
import { AREAS, AREA_HREFS, AREA_LABELS, atLeast, type Area } from "@/lib/permissions-types";
import AppNav, { type NavItem } from "@/components/AppNav";

/** The icon each section is known by, kept next to the nav that draws them. */
const ICONS: Record<Area, NavItem["icon"]> = {
  calendar: "calendar",
  weddings: "events",
  reports: "clipboard",
  venues: "pin",
  dispatch: "truck",
  rentals: "key",
  team: "people",
  outbox: "mail",
  activity: "activity",
  settings: "settings",
};

/**
 * Which sections appear where. The first group is everyday work, the second is
 * the office side — the split is presentational, and what somebody may actually
 * reach is decided by their permissions, not by which list a name sits in.
 */
const EVERYDAY: Area[] = ["calendar", "weddings"];

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const permissions = permissionsFor(user);

  // Built from what this person can actually open. A nav that lists a page and
  // then bounces you off it is worse than one that never offered.
  const itemsFor = (areas: Area[]): NavItem[] =>
    areas
      .filter((area) => atLeast(permissions[area], "view"))
      .map((area) => ({
        href: AREA_HREFS[area],
        label: AREA_LABELS[area],
        icon: ICONS[area],
      }));

  // The dashboard and My page are not sections anybody can be refused from:
  // one is where a refusal sends you, and the other is theirs.
  const main: NavItem[] = [
    { href: "/dashboard", label: "Dashboard", icon: "dashboard" },
    ...itemsFor(EVERYDAY),
    { href: "/me", label: "My page", icon: "person" },
  ];
  const admin: NavItem[] = itemsFor(AREAS.filter((a) => !EVERYDAY.includes(a)));

  return (
    <div className="shell">
      <AppNav main={main} admin={admin} user={{ name: user.name, role: user.role }} />
      <div className="main">{children}</div>
    </div>
  );
}

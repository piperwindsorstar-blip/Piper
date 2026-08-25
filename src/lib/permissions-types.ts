/**
 * What each person is allowed to reach, kept apart from `permissions.ts`.
 *
 * Same split as the other `-types` files: `permissions.ts` reaches the database
 * and better-sqlite3 is Node-only, so a Client Component importing these lists
 * from it would drag the driver into the browser bundle.
 */

/**
 * The sections a permission can be set on.
 *
 * Deliberately not every page. The dashboard is missing because it is where
 * somebody is sent when they are refused, and a section you can be refused
 * from *and* be sent to is a redirect loop. "My page" is missing because it is
 * theirs — there is nothing there to grant.
 *
 * The order is the order they appear in the nav, so the settings form reads
 * like the thing it is configuring.
 */
export const AREAS = [
  "calendar",
  "weddings",
  "reports",
  "venues",
  "dispatch",
  "rentals",
  "team",
  "outbox",
  "activity",
  "settings",
] as const;
export type Area = (typeof AREAS)[number];

export const AREA_LABELS: Record<Area, string> = {
  calendar: "Calendar",
  weddings: "Weddings",
  reports: "Crew Reports",
  venues: "Venues",
  dispatch: "Dispatch",
  rentals: "Rentals",
  team: "Staff",
  outbox: "Outbox",
  activity: "Activity",
  settings: "Settings",
};

/** What each one is, in the words of somebody deciding whether to grant it. */
export const AREA_NOTES: Record<Area, string> = {
  calendar: "The month, and who is on what",
  weddings: "The bookings themselves — a DJ only ever sees their own",
  reports: "Show and warehouse reports, and who returned what",
  venues: "The venue list and the notes crews leave on them",
  dispatch: "The vehicle board, the plan and who drove",
  rentals: "Gear hired in, and the places it comes from",
  team: "Staff records — and this page, where access is set",
  outbox: "Email waiting to go out, and what has been sent",
  activity: "Sign-ins and the record of who changed what",
  settings: "Mail, the sign-in notice, the crew board, shop details",
};

/** Where each one lives, so the nav and the redirects agree. */
export const AREA_HREFS: Record<Area, string> = {
  calendar: "/calendar",
  weddings: "/events",
  reports: "/reports",
  venues: "/venues",
  dispatch: "/dispatch",
  rentals: "/rentals",
  team: "/team",
  outbox: "/outbox",
  activity: "/activity",
  settings: "/settings",
};

export const LEVELS = ["none", "view", "edit"] as const;
export type Level = (typeof LEVELS)[number];

export const LEVEL_LABELS: Record<Level, string> = {
  none: "No access",
  view: "Can look",
  edit: "Can change",
};

/** Ranked, so "is this enough?" is a comparison rather than a list of cases. */
const RANK: Record<Level, number> = { none: 0, view: 1, edit: 2 };

export function atLeast(has: Level, needs: Level): boolean {
  return RANK[has] >= RANK[needs];
}

export function isArea(value: unknown): value is Area {
  return typeof value === "string" && (AREAS as readonly string[]).includes(value);
}

export function isLevel(value: unknown): value is Level {
  return typeof value === "string" && (LEVELS as readonly string[]).includes(value);
}

/**
 * What a role gets when nobody has said otherwise.
 *
 * These are exactly what the two roles could reach before permissions existed,
 * which is the point: adding this feature must not move anybody's access on the
 * day it ships. A per-person setting is an override of these, not a replacement
 * — so a role's defaults can be changed later and everybody who was never
 * given an override moves with it.
 */
export const ROLE_DEFAULTS: Record<"admin" | "dj", Record<Area, Level>> = {
  admin: {
    calendar: "edit",
    weddings: "edit",
    reports: "edit",
    venues: "edit",
    dispatch: "edit",
    rentals: "edit",
    team: "edit",
    outbox: "edit",
    activity: "edit",
    settings: "edit",
  },
  dj: {
    calendar: "view",
    weddings: "view",
    reports: "none",
    venues: "none",
    dispatch: "none",
    rentals: "none",
    team: "none",
    outbox: "none",
    activity: "none",
    settings: "none",
  },
};

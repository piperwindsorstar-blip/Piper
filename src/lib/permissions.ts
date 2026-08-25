import "server-only";
import { db } from "./db";
import {
  AREAS,
  ROLE_DEFAULTS,
  atLeast,
  isArea,
  isLevel,
  type Area,
  type Level,
} from "./permissions-types";

/**
 * Who can reach what.
 *
 * Only overrides are stored. A person with no rows gets their role's defaults,
 * which are exactly what that role could reach before this existed — so nobody's
 * access moved on the day it shipped, and a role's defaults can still be
 * changed later for everybody who was never given an override.
 *
 * The whole map for one person is read at once rather than a query per page.
 * It is ten rows at most and it is read on every request, so a round trip per
 * area would be ten round trips to render one nav.
 */

export type PermissionMap = Record<Area, Level>;

type Holder = { id: number; role: "admin" | "dj" };

export function permissionsFor(user: Holder): PermissionMap {
  const map = { ...ROLE_DEFAULTS[user.role] };

  const rows = db()
    .prepare("SELECT area, level FROM user_permissions WHERE user_id = ?")
    .all(user.id) as { area: string; level: string }[];

  for (const row of rows) {
    if (isArea(row.area) && isLevel(row.level)) map[row.area] = row.level;
  }
  return map;
}

/** Just the overrides, for a form that has to show what was set apart from what was inherited. */
export function overridesFor(userId: number): Partial<PermissionMap> {
  const rows = db()
    .prepare("SELECT area, level FROM user_permissions WHERE user_id = ?")
    .all(userId) as { area: string; level: string }[];

  const out: Partial<PermissionMap> = {};
  for (const row of rows) {
    if (isArea(row.area) && isLevel(row.level)) out[row.area] = row.level;
  }
  return out;
}

export function can(user: Holder, area: Area, needs: Level = "view"): boolean {
  return atLeast(permissionsFor(user)[area], needs);
}

/**
 * Replaces one person's overrides wholesale.
 *
 * A row is written only where the level differs from the role default, so
 * "everything as usual" stores nothing and a later change to the defaults still
 * reaches them. Done in a transaction because a half-applied permission set is
 * the one state nobody could reason about.
 */
export function setPermissions(
  user: Holder,
  wanted: Partial<Record<Area, Level>>,
): void {
  const defaults = ROLE_DEFAULTS[user.role];
  const conn = db();

  const clear = conn.prepare("DELETE FROM user_permissions WHERE user_id = ?");
  const insert = conn.prepare(
    "INSERT INTO user_permissions (user_id, area, level) VALUES (?, ?, ?)",
  );

  const apply = conn.transaction(() => {
    clear.run(user.id);
    for (const area of AREAS) {
      const level = wanted[area];
      if (!level || level === defaults[area]) continue;
      insert.run(user.id, area, level);
    }
  });
  apply();
}

/**
 * How many people could still change permissions if this one were saved.
 *
 * Staff-edit is the permission that grants every other permission, so losing
 * the last of it locks the whole app out of its own administration with no way
 * back except the sqlite prompt. Counted across active users only — a retired
 * account cannot sign in to rescue anybody.
 */
export function keyholdersAfter(userId: number, level: Level): number {
  const users = db()
    .prepare("SELECT id, role FROM users WHERE active = 1")
    .all() as Holder[];

  return users.filter((u) => {
    const effective = u.id === userId ? level : permissionsFor(u)["team"];
    return atLeast(effective, "edit");
  }).length;
}

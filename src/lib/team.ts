import { db } from "./db";
import { hashPassword } from "./password";
import { USER_COLUMNS } from "./user-columns";
import type { Role, User } from "./auth";

export function listUsers(includeInactive = false): User[] {
  return db()
    .prepare(
      `SELECT ${USER_COLUMNS} FROM users ${includeInactive ? "" : "WHERE active = 1"}
       ORDER BY role DESC, name COLLATE NOCASE`,
    )
    .all() as User[];
}

export function listDjs(): User[] {
  return db()
    .prepare(`SELECT ${USER_COLUMNS} FROM users WHERE active = 1 ORDER BY name COLLATE NOCASE`)
    .all() as User[];
}

export function getUser(id: number): User | null {
  return (db().prepare(`SELECT ${USER_COLUMNS} FROM users WHERE id = ?`).get(id) as User | undefined) ?? null;
}

/** The one query that returns the hash. Server-side only, for verifying a login. */
export function getUserByEmail(email: string): (User & { password_hash: string }) | null {
  return (
    (db().prepare("SELECT * FROM users WHERE email = ?").get(email) as
      | (User & { password_hash: string })
      | undefined) ?? null
  );
}

export type UserInput = {
  email: string;
  name: string;
  phone: string | null;
  role: Role;
};

/** The optional staff-record fields, edited separately from the login details. */
export type StaffRecordInput = {
  emergency_contact: string | null;
  start_date: string | null;
  gear: string | null;
  staff_notes: string | null;
};

export function updateStaffRecord(id: number, input: StaffRecordInput): void {
  db()
    .prepare(
      `UPDATE users SET emergency_contact = ?, start_date = ?, gear = ?, staff_notes = ?
       WHERE id = ?`,
    )
    .run(input.emergency_contact, input.start_date, input.gear, input.staff_notes, id);
}

/** What each person lets you edit about themselves. */
export function updateOwnDetails(id: number, name: string, phone: string | null): void {
  db().prepare("UPDATE users SET name = ?, phone = ? WHERE id = ?").run(name, phone, id);
}

export type StaffStats = {
  upcoming: number;
  completed: number;
  total: number;
  nextDate: string | null;
  lastDate: string | null;
};

/**
 * Workload for one person. Cancelled events never count — they didn't happen
 * and shouldn't inflate anyone's record.
 */
export function staffStats(userId: number): StaffStats {
  const row = db()
    .prepare(
      `SELECT
         COUNT(*) FILTER (WHERE event_date >= date('now') AND status != 'cancelled') AS upcoming,
         COUNT(*) FILTER (WHERE event_date <  date('now') AND status != 'cancelled') AS completed,
         COUNT(*) FILTER (WHERE status != 'cancelled')                               AS total,
         MIN(CASE WHEN event_date >= date('now') AND status != 'cancelled' THEN event_date END) AS nextDate,
         MAX(CASE WHEN event_date <  date('now') AND status != 'cancelled' THEN event_date END) AS lastDate
       FROM events WHERE assigned_dj_id = ?`,
    )
    .get(userId) as StaffStats;
  return row;
}

/** Roster-wide counts in one query, so the staff list isn't N+1. */
export function statsForAll(): Map<number, StaffStats> {
  const rows = db()
    .prepare(
      `SELECT assigned_dj_id AS id,
         COUNT(*) FILTER (WHERE event_date >= date('now') AND status != 'cancelled') AS upcoming,
         COUNT(*) FILTER (WHERE event_date <  date('now') AND status != 'cancelled') AS completed,
         COUNT(*) FILTER (WHERE status != 'cancelled')                               AS total,
         MIN(CASE WHEN event_date >= date('now') AND status != 'cancelled' THEN event_date END) AS nextDate,
         MAX(CASE WHEN event_date <  date('now') AND status != 'cancelled' THEN event_date END) AS lastDate
       FROM events WHERE assigned_dj_id IS NOT NULL GROUP BY assigned_dj_id`,
    )
    .all() as (StaffStats & { id: number })[];
  return new Map(rows.map((r) => [r.id, r]));
}

export function createUser(input: UserInput, password: string): number {
  const result = db()
    .prepare(
      "INSERT INTO users (email, name, phone, role, password_hash) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.email, input.name, input.phone, input.role, hashPassword(password));
  return Number(result.lastInsertRowid);
}

export function updateUser(id: number, input: UserInput): void {
  db()
    .prepare("UPDATE users SET email = ?, name = ?, phone = ?, role = ? WHERE id = ?")
    .run(input.email, input.name, input.phone, input.role, id);
}

export function setPassword(id: number, password: string): void {
  db().prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(hashPassword(password), id);
}

/**
 * Deactivating rather than deleting keeps a departed DJ's name on past events.
 * Their sessions are dropped so access ends immediately.
 */
export function setActive(id: number, active: boolean): void {
  db().prepare("UPDATE users SET active = ? WHERE id = ?").run(active ? 1 : 0, id);
  if (!active) db().prepare("DELETE FROM sessions WHERE user_id = ?").run(id);
}

export function countAdmins(): number {
  const row = db()
    .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'admin' AND active = 1")
    .get() as { n: number };
  return row.n;
}

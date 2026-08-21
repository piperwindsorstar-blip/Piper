import crypto from "node:crypto";
import { db, nowIso } from "./db";
import type { User } from "./auth";
import type { EventRow, EventStatus, EventWithRefs, Venue } from "./types";

const EVENT_SELECT = `
  SELECT e.*, v.name AS venue_name, v.city AS venue_city, u.name AS dj_name
  FROM events e
  LEFT JOIN venues v ON v.id = e.venue_id
  LEFT JOIN users u ON u.id = e.assigned_dj_id
`;

/** DJs only ever see the events they are assigned to; admins see everything. */
function scopeClause(user: User): { sql: string; params: unknown[] } {
  return user.role === "admin"
    ? { sql: "", params: [] }
    : { sql: " AND e.assigned_dj_id = ?", params: [user.id] };
}

export type EventFilters = {
  status?: EventStatus | "all" | "upcoming";
  search?: string;
  djId?: number;
};

export function listEvents(user: User, filters: EventFilters = {}): EventWithRefs[] {
  const scope = scopeClause(user);
  const where: string[] = ["1 = 1"];
  const params: unknown[] = [];

  if (filters.status === "upcoming") {
    where.push("e.event_date >= date('now') AND e.status != 'cancelled'");
  } else if (filters.status && filters.status !== "all") {
    where.push("e.status = ?");
    params.push(filters.status);
  }

  if (filters.djId) {
    where.push("e.assigned_dj_id = ?");
    params.push(filters.djId);
  }

  if (filters.search?.trim()) {
    const like = `%${filters.search.trim()}%`;
    where.push(
      "(e.partner_one_name LIKE ? OR e.partner_two_name LIKE ? OR v.name LIKE ? OR e.contact_email LIKE ?)",
    );
    params.push(like, like, like, like);
  }

  return db()
    .prepare(
      `${EVENT_SELECT} WHERE ${where.join(" AND ")}${scope.sql} ORDER BY e.event_date ASC, e.id ASC`,
    )
    .all(...params, ...scope.params) as EventWithRefs[];
}

export function getEvent(user: User, id: number): EventWithRefs | null {
  const scope = scopeClause(user);
  const row = db()
    .prepare(`${EVENT_SELECT} WHERE e.id = ?${scope.sql}`)
    .get(id, ...scope.params) as EventWithRefs | undefined;
  return row ?? null;
}

export function getEventByToken(token: string): EventWithRefs | null {
  const row = db()
    .prepare(`${EVENT_SELECT} WHERE e.plan_token = ?`)
    .get(token) as EventWithRefs | undefined;
  return row ?? null;
}

export function eventsBetween(user: User, startDate: string, endDate: string): EventWithRefs[] {
  const scope = scopeClause(user);
  return db()
    .prepare(
      `${EVENT_SELECT} WHERE e.event_date >= ? AND e.event_date <= ?${scope.sql}
       ORDER BY e.event_date ASC, e.reception_time ASC`,
    )
    .all(startDate, endDate, ...scope.params) as EventWithRefs[];
}

/** Every event assigned to one person, newest first. Admin-facing. */
export function eventsAssignedTo(userId: number): EventWithRefs[] {
  return db()
    .prepare(`${EVENT_SELECT} WHERE e.assigned_dj_id = ? ORDER BY e.event_date DESC`)
    .all(userId) as EventWithRefs[];
}

/* ------------------------------------------------------------------ writes */

export type EventInput = {
  status: EventStatus;
  partner_one_name: string;
  partner_two_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  event_date: string;
  load_in_time: string | null;
  ceremony_time: string | null;
  cocktail_time: string | null;
  reception_time: string | null;
  end_time: string | null;
  venue_id: number | null;
  venue_room: string | null;
  guest_count: number | null;
  package_name: string | null;
  assigned_dj_id: number | null;
  internal_notes: string | null;
};

const EVENT_FIELDS: (keyof EventInput)[] = [
  "status",
  "partner_one_name",
  "partner_two_name",
  "contact_email",
  "contact_phone",
  "event_date",
  "load_in_time",
  "ceremony_time",
  "cocktail_time",
  "reception_time",
  "end_time",
  "venue_id",
  "venue_room",
  "guest_count",
  "package_name",
  "assigned_dj_id",
  "internal_notes",
];

export function createEvent(input: EventInput): number {
  const token = crypto.randomBytes(16).toString("hex");
  const cols = [...EVENT_FIELDS, "plan_token"];
  const result = db()
    .prepare(
      `INSERT INTO events (${cols.join(", ")}) VALUES (${cols.map(() => "?").join(", ")})`,
    )
    .run(...EVENT_FIELDS.map((f) => input[f]), token);
  return Number(result.lastInsertRowid);
}

export function updateEvent(id: number, input: EventInput): void {
  db()
    .prepare(
      `UPDATE events SET ${EVENT_FIELDS.map((f) => `${f} = ?`).join(", ")}, updated_at = ?
       WHERE id = ?`,
    )
    .run(...EVENT_FIELDS.map((f) => input[f]), nowIso(), id);
}

export function deleteEvent(id: number): void {
  db().prepare("DELETE FROM events WHERE id = ?").run(id);
}

export function touchEvent(id: number): void {
  db().prepare("UPDATE events SET updated_at = ? WHERE id = ?").run(nowIso(), id);
}

export function regeneratePlanToken(id: number): string {
  const token = crypto.randomBytes(16).toString("hex");
  db().prepare("UPDATE events SET plan_token = ?, updated_at = ? WHERE id = ?").run(token, nowIso(), id);
  return token;
}

/* ------------------------------------------------------------- conflicts */

export type Conflict = {
  kind: "dj" | "date";
  event: EventRow & { dj_name: string | null };
};

/**
 * Two kinds of trouble on a wedding date: the same DJ booked twice (hard clash),
 * and two events on one date (fine if you have the staff, worth a heads-up).
 * Cancelled events never conflict.
 */
export function conflictsFor(eventId: number | null, date: string, djId: number | null): Conflict[] {
  const rows = db()
    .prepare(
      `SELECT e.*, u.name AS dj_name FROM events e
       LEFT JOIN users u ON u.id = e.assigned_dj_id
       WHERE e.event_date = ? AND e.status != 'cancelled' AND e.id != ?
       ORDER BY e.id`,
    )
    .all(date, eventId ?? -1) as (EventRow & { dj_name: string | null })[];

  return rows.map((event) => ({
    kind: djId != null && event.assigned_dj_id === djId ? ("dj" as const) : ("date" as const),
    event,
  }));
}

/** Dates carrying more than one live event, used to flag days on the calendar. */
export function overbookedDates(startDate: string, endDate: string): Set<string> {
  const rows = db()
    .prepare(
      `SELECT event_date FROM events
       WHERE event_date BETWEEN ? AND ? AND status != 'cancelled'
       GROUP BY event_date HAVING COUNT(*) > 1`,
    )
    .all(startDate, endDate) as { event_date: string }[];
  return new Set(rows.map((r) => r.event_date));
}

/* ---------------------------------------------------------------- venues */

export function listVenues(): Venue[] {
  return db().prepare("SELECT * FROM venues ORDER BY name COLLATE NOCASE").all() as Venue[];
}

export function getVenue(id: number): Venue | null {
  return (db().prepare("SELECT * FROM venues WHERE id = ?").get(id) as Venue | undefined) ?? null;
}

export type VenueInput = Omit<Venue, "id" | "created_at">;

export function createVenue(input: VenueInput): number {
  const result = db()
    .prepare(
      `INSERT INTO venues (name, address, city, contact_name, contact_email, contact_phone, load_in_notes)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.name,
      input.address,
      input.city,
      input.contact_name,
      input.contact_email,
      input.contact_phone,
      input.load_in_notes,
    );
  return Number(result.lastInsertRowid);
}

export function updateVenue(id: number, input: VenueInput): void {
  db()
    .prepare(
      `UPDATE venues SET name = ?, address = ?, city = ?, contact_name = ?,
       contact_email = ?, contact_phone = ?, load_in_notes = ? WHERE id = ?`,
    )
    .run(
      input.name,
      input.address,
      input.city,
      input.contact_name,
      input.contact_email,
      input.contact_phone,
      input.load_in_notes,
      id,
    );
}

export function deleteVenue(id: number): void {
  db().prepare("DELETE FROM venues WHERE id = ?").run(id);
}

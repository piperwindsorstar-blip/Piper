import { db, nowIso } from "./db";
import { formatDate, formatTime } from "./dates";
import { STATUS_LABELS, type EventRow, type EventStatus } from "./types";
import type { User } from "./auth";
import type { EventInput } from "./events";

/**
 * The history of a booking: who changed what, and when.
 *
 * Two rules shape this module.
 *
 * Values are stored as display text, not raw ids. A row saying
 * `venue_id: 2 -> 3` is useless a year later, and useless immediately if the
 * venue has since been renamed or deleted. Names are resolved once, at write
 * time, and the history then reads correctly forever.
 *
 * Rows outlive the event. There is no cascade from events, because the single
 * most useful thing an audit trail can tell you is who deleted a booking — and
 * a cascade would delete exactly that row along with the evidence.
 *
 * Everything here is admin-only at the callers. Field values include the
 * internal notes, which DJs must never see.
 */

export type AuditAction =
  | "created"
  | "updated"
  | "deleted"
  | "plan_link_rotated"
  | "plan_submitted";

export type AuditEntry = {
  id: number;
  event_id: number;
  event_label: string;
  actor_user_id: number | null;
  actor_label: string;
  action: AuditAction;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  at: string;
};

/** Who did it. The couple act through the planner link and have no account. */
export type Actor = { userId: number | null; label: string };

export const asActor = (user: User): Actor => ({ userId: user.id, label: user.name });
export const THE_COUPLE: Actor = { userId: null, label: "The couple" };

const FIELD_LABELS: Record<keyof EventInput, string> = {
  status: "Status",
  partner_one_name: "First name on the booking",
  partner_two_name: "Second name on the booking",
  contact_email: "Contact email",
  contact_phone: "Contact phone",
  event_date: "Event date",
  load_in_time: "Load-in time",
  ceremony_time: "Ceremony time",
  cocktail_time: "Cocktail time",
  reception_time: "Reception time",
  end_time: "End time",
  venue_id: "Venue",
  venue_room: "Room",
  guest_count: "Guest count",
  package_name: "Package",
  assigned_dj_id: "DJ",
  internal_notes: "Internal notes",
};

export const ACTION_LABELS: Record<AuditAction, string> = {
  created: "Created the booking",
  updated: "Edited the booking",
  deleted: "Deleted the booking",
  plan_link_rotated: "Issued a new planner link",
  plan_submitted: "Sent in their plan",
};

export function eventLabel(event: Pick<EventRow, "partner_one_name" | "partner_two_name" | "event_date">): string {
  const couple = event.partner_two_name
    ? `${event.partner_one_name} & ${event.partner_two_name}`
    : event.partner_one_name;
  return `${couple} · ${event.event_date}`;
}

function venueName(id: number | null): string | null {
  if (id === null) return null;
  const row = db().prepare("SELECT name FROM venues WHERE id = ?").get(id) as
    | { name: string }
    | undefined;
  return row?.name ?? `Venue #${id}`;
}

function userName(id: number | null): string | null {
  if (id === null) return null;
  const row = db().prepare("SELECT name FROM users WHERE id = ?").get(id) as
    | { name: string }
    | undefined;
  return row?.name ?? `User #${id}`;
}

const TIME_FIELDS = new Set<keyof EventInput>([
  "load_in_time",
  "ceremony_time",
  "cocktail_time",
  "reception_time",
  "end_time",
]);

/**
 * Turns a stored field value into the text a person should read — the same
 * text the rest of the app would show. A history that reports `16:00` while
 * every other screen says `4:00 PM` makes the reader do the conversion.
 */
function display(field: keyof EventInput, value: unknown): string | null {
  if (value === null || value === undefined || value === "") return null;
  if (field === "venue_id") return venueName(Number(value));
  if (field === "assigned_dj_id") return userName(Number(value));
  if (field === "status") return STATUS_LABELS[value as EventStatus] ?? String(value);
  if (field === "event_date") return formatDate(String(value));
  if (TIME_FIELDS.has(field)) return formatTime(String(value));
  return String(value);
}

const insert = () =>
  db().prepare(
    `INSERT INTO event_audit
       (event_id, event_label, actor_user_id, actor_label, action, field, old_value, new_value, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

/** A single entry with no field-level detail: created, deleted, and so on. */
export function recordEventAction(
  eventId: number,
  label: string,
  actor: Actor,
  action: AuditAction,
): void {
  insert().run(eventId, label, actor.userId, actor.label, action, null, null, null, nowIso());
}

/**
 * One row per field that actually changed. A save that changes nothing writes
 * nothing — a history full of "edited, no changes" is noise that hides the
 * entries that matter.
 *
 * Returns how many fields changed, so callers can tell a real edit from a no-op.
 */
export function recordEventUpdate(
  eventId: number,
  label: string,
  actor: Actor,
  before: EventRow,
  after: EventInput,
): number {
  const at = nowIso();
  const statement = insert();
  const fields = Object.keys(FIELD_LABELS) as (keyof EventInput)[];
  let changed = 0;

  const write = db().transaction(() => {
    for (const field of fields) {
      // Normalise before comparing: a null and an empty string are the same
      // absence, and a number from a form arrives as a string.
      const oldRaw = before[field as keyof EventRow] ?? null;
      const newRaw = after[field] ?? null;
      if (String(oldRaw ?? "") === String(newRaw ?? "")) continue;

      changed += 1;
      statement.run(
        eventId,
        label,
        actor.userId,
        actor.label,
        "updated",
        FIELD_LABELS[field],
        display(field, oldRaw),
        display(field, newRaw),
        at,
      );
    }
  });

  write();
  return changed;
}

/**
 * One edit writes a row per changed field. For reading, those belong back
 * together: "Sam changed the ceremony time and the DJ" is one event in the
 * story, not two.
 */
export type AuditGroup = {
  key: string;
  at: string;
  actor_label: string;
  action: AuditAction;
  event_id: number;
  event_label: string;
  changes: { field: string; old_value: string | null; new_value: string | null }[];
};

export function groupEntries(entries: AuditEntry[]): AuditGroup[] {
  const groups: AuditGroup[] = [];
  let current: AuditGroup | null = null;

  for (const entry of entries) {
    const key = `${entry.event_id}|${entry.at}|${entry.actor_label}|${entry.action}`;
    if (!current || current.key !== key) {
      current = {
        key,
        at: entry.at,
        actor_label: entry.actor_label,
        action: entry.action,
        event_id: entry.event_id,
        event_label: entry.event_label,
        changes: [],
      };
      groups.push(current);
    }
    if (entry.field) {
      current.changes.push({
        field: entry.field,
        old_value: entry.old_value,
        new_value: entry.new_value,
      });
    }
  }

  return groups;
}

export function eventHistory(eventId: number, limit = 50): AuditEntry[] {
  return db()
    .prepare("SELECT * FROM event_audit WHERE event_id = ? ORDER BY at DESC, id DESC LIMIT ?")
    .all(eventId, limit) as AuditEntry[];
}

export function recentActivity(limit = 200): AuditEntry[] {
  return db()
    .prepare("SELECT * FROM event_audit ORDER BY at DESC, id DESC LIMIT ?")
    .all(limit) as AuditEntry[];
}

/** Event ids that still exist, so the activity page knows what it can link to. */
export function liveEventIds(): Set<number> {
  const rows = db().prepare("SELECT id FROM events").all() as { id: number }[];
  return new Set(rows.map((r) => r.id));
}

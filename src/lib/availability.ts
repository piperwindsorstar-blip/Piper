import crypto from "node:crypto";
import { db, nowIso } from "./db";

/**
 * Asking a DJ whether they can work a date.
 *
 * The answer arrives one of two ways: a link in the email, which needs no
 * login, or the DJ's own dashboard once they sign in. A DJ checking their
 * phone on the way home from another gig should not have to log in to say yes.
 *
 * The token is what makes the link work, so it is random per request and
 * single-purpose: it answers one question about one event and grants nothing
 * else. Answering is idempotent — a DJ who taps "yes" twice, or forwards the
 * email to themselves, does not break anything.
 */

export type AvailabilityStatus = "asked" | "available" | "unavailable";

export type AvailabilityRequest = {
  id: number;
  event_id: number;
  dj_id: number;
  token: string;
  status: AvailabilityStatus;
  note: string | null;
  asked_at: string;
  responded_at: string | null;
};

export type AvailabilityWithDj = AvailabilityRequest & { dj_name: string; dj_email: string };

/**
 * Records the ask and returns it. Asking the same DJ about the same event again
 * reuses the existing row rather than creating a second one — but clears a
 * previous answer, since re-asking means the situation changed.
 */
export function askAvailability(eventId: number, djId: number): AvailabilityRequest {
  const existing = db()
    .prepare("SELECT * FROM availability_requests WHERE event_id = ? AND dj_id = ?")
    .get(eventId, djId) as AvailabilityRequest | undefined;

  if (existing) {
    db()
      .prepare(
        `UPDATE availability_requests
         SET status = 'asked', note = NULL, asked_at = ?, responded_at = NULL
         WHERE id = ?`,
      )
      .run(nowIso(), existing.id);
    return { ...existing, status: "asked", note: null, asked_at: nowIso(), responded_at: null };
  }

  const token = crypto.randomBytes(16).toString("hex");
  const result = db()
    .prepare(
      `INSERT INTO availability_requests (event_id, dj_id, token, status, asked_at)
       VALUES (?, ?, ?, 'asked', ?)`,
    )
    .run(eventId, djId, token, nowIso());

  return {
    id: Number(result.lastInsertRowid),
    event_id: eventId,
    dj_id: djId,
    token,
    status: "asked",
    note: null,
    asked_at: nowIso(),
    responded_at: null,
  };
}

export function requestsForEvent(eventId: number): AvailabilityWithDj[] {
  return db()
    .prepare(
      `SELECT a.*, u.name AS dj_name, u.email AS dj_email
       FROM availability_requests a
       JOIN users u ON u.id = a.dj_id
       WHERE a.event_id = ?
       ORDER BY a.asked_at DESC`,
    )
    .all(eventId) as AvailabilityWithDj[];
}

/** Open questions for one DJ, for their own dashboard. */
export function openRequestsFor(djId: number): (AvailabilityRequest & {
  partner_one_name: string;
  partner_two_name: string | null;
  event_date: string;
  venue_name: string | null;
})[] {
  return db()
    .prepare(
      `SELECT a.*, e.partner_one_name, e.partner_two_name, e.event_date, v.name AS venue_name
       FROM availability_requests a
       JOIN events e ON e.id = a.event_id
       LEFT JOIN venues v ON v.id = e.venue_id
       WHERE a.dj_id = ? AND a.status = 'asked'
       ORDER BY e.event_date`,
    )
    .all(djId) as never;
}

export function byToken(token: string): (AvailabilityWithDj & {
  partner_one_name: string;
  partner_two_name: string | null;
  event_date: string;
  venue_name: string | null;
  venue_city: string | null;
}) | null {
  return (
    (db()
      .prepare(
        `SELECT a.*, u.name AS dj_name, u.email AS dj_email,
                e.partner_one_name, e.partner_two_name, e.event_date,
                v.name AS venue_name, v.city AS venue_city
         FROM availability_requests a
         JOIN users u ON u.id = a.dj_id
         JOIN events e ON e.id = a.event_id
         LEFT JOIN venues v ON v.id = e.venue_id
         WHERE a.token = ?`,
      )
      .get(token) as never) ?? null
  );
}

export function answer(
  token: string,
  status: "available" | "unavailable",
  note?: string | null,
): boolean {
  const result = db()
    .prepare(
      `UPDATE availability_requests
       SET status = ?, note = ?, responded_at = ?
       WHERE token = ?`,
    )
    .run(status, note?.trim() || null, nowIso(), token);
  return result.changes > 0;
}

/** The same answer, from a signed-in DJ rather than an emailed link. */
export function answerAsDj(
  requestId: number,
  djId: number,
  status: "available" | "unavailable",
): boolean {
  const result = db()
    .prepare(
      `UPDATE availability_requests
       SET status = ?, responded_at = ?
       WHERE id = ? AND dj_id = ?`,
    )
    .run(status, nowIso(), requestId, djId);
  return result.changes > 0;
}

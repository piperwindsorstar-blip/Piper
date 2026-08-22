import "server-only";
import crypto from "node:crypto";
import { db, nowIso } from "./db";
import { hashPassword } from "./password";
import type { User } from "./auth";

/**
 * Forgotten-password links.
 *
 * Three rules, all of them the reason this is its own module rather than a few
 * lines in an action.
 *
 * The token is the entire secret, so it is long, random, single-use and short-
 * lived, and requesting a new one voids any earlier link. A reset that stayed
 * valid after use would turn one intercepted email into permanent access.
 *
 * Nothing here ever reveals whether an email has an account. The request path
 * returns the same thing either way and the page says the same thing either
 * way; only the log and the admin's own screens know the difference.
 *
 * Completing a reset ends every existing session for that person. If the
 * reason they are resetting is that someone else got in, leaving that person's
 * session alive would defeat the whole exercise.
 */

/** Long enough to be unguessable, short enough to survive an email client. */
const TOKEN_BYTES = 32;

/** Long enough to find the email and act on it, short enough to matter. */
const VALID_HOURS = 2;

/** A person fumbling their password is normal; forty requests an hour is not. */
const MAX_PER_HOUR = 5;

export type ResetRow = {
  id: number;
  user_id: number;
  token: string;
  requested_ip: string | null;
  created_at: string;
  expires_at: string;
  used_at: string | null;
};

function isoIn(hours: number): string {
  return new Date(Date.now() + hours * 3_600_000).toISOString().replace("T", " ").slice(0, 19);
}

function isoAgo(hours: number): string {
  return new Date(Date.now() - hours * 3_600_000).toISOString().replace("T", " ").slice(0, 19);
}

/** How many links this person has asked for in the last hour. */
export function requestsInLastHour(userId: number): number {
  const row = db()
    .prepare("SELECT COUNT(*) AS n FROM password_resets WHERE user_id = ? AND created_at >= ?")
    .get(userId, isoAgo(1)) as { n: number };
  return row.n;
}

/**
 * Issues a link, voiding any the person already has.
 *
 * Returns null when they have asked too many times in the last hour — the
 * caller still tells them the same thing either way, so a flood of requests
 * neither floods their inbox nor reveals anything by behaving differently.
 */
export function createReset(userId: number, ip: string | null): string | null {
  if (requestsInLastHour(userId) >= MAX_PER_HOUR) return null;

  const token = crypto.randomBytes(TOKEN_BYTES).toString("hex");

  const issue = db().transaction(() => {
    // An earlier link is void the moment a new one is asked for: two live
    // links means the older email is still a way in long after its owner
    // stopped thinking about it.
    db()
      .prepare("UPDATE password_resets SET used_at = ? WHERE user_id = ? AND used_at IS NULL")
      .run(nowIso(), userId);

    db()
      .prepare(
        `INSERT INTO password_resets (user_id, token, requested_ip, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?)`,
      )
      .run(userId, token, ip, nowIso(), isoIn(VALID_HOURS));
  });

  issue();
  return token;
}

export type ResetTarget = { reset: ResetRow; user: User };

/**
 * The account a live token belongs to, or null.
 *
 * Null covers every failure the same way — unknown, spent, expired, or the
 * account since deactivated — because the page must not explain which.
 */
export function resetTarget(token: string): ResetTarget | null {
  if (!token || token.length !== TOKEN_BYTES * 2) return null;

  const reset = db().prepare("SELECT * FROM password_resets WHERE token = ?").get(token) as
    | ResetRow
    | undefined;
  if (!reset || reset.used_at !== null || reset.expires_at <= nowIso()) return null;

  const user = db()
    .prepare("SELECT * FROM users WHERE id = ? AND active = 1")
    .get(reset.user_id) as User | undefined;
  if (!user) return null;

  return { reset, user };
}

/**
 * Sets the new password, spends the token, and signs the account out
 * everywhere. Returns false if the token stopped being valid in the meantime —
 * two tabs, or a second click.
 */
export function completeReset(token: string, newPassword: string): boolean {
  const target = resetTarget(token);
  if (!target) return false;

  const finish = db().transaction(() => {
    db()
      .prepare("UPDATE users SET password_hash = ? WHERE id = ?")
      .run(hashPassword(newPassword), target.user.id);
    db().prepare("UPDATE password_resets SET used_at = ? WHERE id = ?").run(nowIso(), target.reset.id);
    // Everywhere means everywhere, including whoever prompted this.
    db().prepare("DELETE FROM sessions WHERE user_id = ?").run(target.user.id);
  });

  finish();
  return true;
}

/** The live link for one person, so an admin can help when mail is down. */
export function pendingReset(userId: number): ResetRow | null {
  return (
    (db()
      .prepare(
        `SELECT * FROM password_resets
          WHERE user_id = ? AND used_at IS NULL AND expires_at > ?
          ORDER BY created_at DESC LIMIT 1`,
      )
      .get(userId, nowIso()) as ResetRow | undefined) ?? null
  );
}

export type ResetRequest = ResetRow & { name: string; email: string };

/** Recent requests across the roster, for the admin's own view. */
export function recentResets(limit = 25): ResetRequest[] {
  return db()
    .prepare(
      `SELECT r.*, u.name, u.email FROM password_resets r
         JOIN users u ON u.id = r.user_id
        ORDER BY r.created_at DESC LIMIT ?`,
    )
    .all(limit) as ResetRequest[];
}

/** Housekeeping: spent and expired rows have no further use. */
export function pruneResets(): void {
  db()
    .prepare("DELETE FROM password_resets WHERE used_at IS NOT NULL OR expires_at <= ?")
    .run(isoAgo(24));
}

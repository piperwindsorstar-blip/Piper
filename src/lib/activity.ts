import { db, nowIso } from "./db";
import type { User } from "./auth";
import type { Actor } from "./audit";

/**
 * Staff activity: when people signed in, and what they changed.
 *
 * Bookings already keep their own history in `event_audit`, and that stays
 * where it is — an event's page wants its own story, not the whole company's.
 * This module adds the two things that were missing.
 *
 * Sign-ins, so "when was Dana last working?" and "is someone guessing at the
 * door?" are answerable. Failures are recorded as well as successes, because a
 * log that only records the times somebody got in tells you nothing about the
 * times somebody tried. Passwords are never written here, in any form.
 *
 * And `record_audit`, which does for staff records, venues and settings what
 * `event_audit` does for bookings — same rules: display text rather than ids,
 * and no cascade, so the row explaining a deletion outlives the thing deleted.
 *
 * Reading the two together is what makes a person's activity legible, so
 * `changesBy` and `recentChanges` union them into one feed.
 */

/* ---------------------------------------------------------------- sign-ins */

export type SignInOutcome = "success" | "failed";

export type SignInRow = {
  id: number;
  user_id: number | null;
  email_tried: string;
  actor_label: string;
  outcome: SignInOutcome;
  reason: string | null;
  ip: string | null;
  user_agent: string | null;
  at: string;
};

export type SignInAttempt = {
  userId: number | null;
  emailTried: string;
  label: string;
  outcome: SignInOutcome;
  reason?: string | null;
  ip?: string | null;
  userAgent?: string | null;
};

export function recordSignIn(attempt: SignInAttempt): void {
  db()
    .prepare(
      `INSERT INTO sign_ins
         (user_id, email_tried, actor_label, outcome, reason, ip, user_agent, at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      attempt.userId,
      attempt.emailTried,
      attempt.label,
      attempt.outcome,
      attempt.reason ?? null,
      attempt.ip ?? null,
      attempt.userAgent ?? null,
      nowIso(),
    );
}

export function recentSignIns(limit = 200): SignInRow[] {
  return db()
    .prepare("SELECT * FROM sign_ins ORDER BY at DESC, id DESC LIMIT ?")
    .all(limit) as SignInRow[];
}

export function signInsForUser(userId: number, limit = 30): SignInRow[] {
  return db()
    .prepare("SELECT * FROM sign_ins WHERE user_id = ? ORDER BY at DESC, id DESC LIMIT ?")
    .all(userId, limit) as SignInRow[];
}

/**
 * Last successful sign-in per person, for the staff list. One query rather
 * than one per row — the roster page would otherwise fan out.
 */
export function lastSignInForAll(): Map<number, string> {
  const rows = db()
    .prepare(
      `SELECT user_id, MAX(at) AS at FROM sign_ins
       WHERE outcome = 'success' AND user_id IS NOT NULL
       GROUP BY user_id`,
    )
    .all() as { user_id: number; at: string }[];
  return new Map(rows.map((r) => [r.user_id, r.at]));
}

/**
 * Failed attempts since a moment, grouped by the email tried. What an admin
 * actually wants to know is not "were there failures" — there are always a
 * few — but "is one account being hammered".
 */
export type FailureCluster = { email_tried: string; n: number; last_at: string };

export function recentFailures(sinceIso: string): FailureCluster[] {
  return db()
    .prepare(
      `SELECT email_tried, COUNT(*) AS n, MAX(at) AS last_at FROM sign_ins
       WHERE outcome = 'failed' AND at >= ?
       GROUP BY email_tried COLLATE NOCASE
       ORDER BY n DESC, last_at DESC`,
    )
    .all(sinceIso) as FailureCluster[];
}

export const REASON_LABELS: Record<string, string> = {
  no_account: "No account with that email",
  wrong_password: "Wrong password",
  deactivated: "Account is deactivated",
};

/* ------------------------------------------------------------ record audit */

/** What a `record_audit` row is about. Bookings have their own table. */
export type SubjectType = "staff" | "venue" | "settings" | "vehicle" | "rental";

export type Subject = { type: SubjectType; id: number | null; label: string };

export const staffSubject = (user: Pick<User, "id" | "name">): Subject => ({
  type: "staff",
  id: user.id,
  label: user.name,
});

export const venueSubject = (id: number | null, name: string): Subject => ({
  type: "venue",
  id,
  label: name,
});

export const settingsSubject: Subject = { type: "settings", id: null, label: "Settings" };

export const vehicleSubject = (id: number | null, name: string): Subject => ({
  type: "vehicle",
  id,
  label: name,
});

/** A place gear is hired from. Its own type, not a vehicle — the feed links
    them to different pages and calling a supplier a vehicle would send anyone
    following the trail to the fleet. */
export const rentalSubject = (id: number | null, name: string): Subject => ({
  type: "rental",
  id,
  label: name,
});

export type FieldChange = { field: string; from: string | null; to: string | null };

const insertRecord = () =>
  db().prepare(
    `INSERT INTO record_audit
       (subject_type, subject_id, subject_label, actor_user_id, actor_label,
        action, field, old_value, new_value, at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

/** An action with no field detail: added, removed, deactivated, and so on. */
export function recordAction(subject: Subject, actor: Actor, action: string): void {
  insertRecord().run(
    subject.type,
    subject.id,
    subject.label,
    actor.userId,
    actor.label,
    action,
    null,
    null,
    null,
    nowIso(),
  );
}

/**
 * One row per field that actually changed, and nothing at all when a save
 * changes nothing. Returns the number written so callers can tell a real edit
 * from a no-op.
 */
export function recordChanges(
  subject: Subject,
  actor: Actor,
  changes: FieldChange[],
): number {
  const real = changes.filter((c) => String(c.from ?? "") !== String(c.to ?? ""));
  if (real.length === 0) return 0;

  const at = nowIso();
  const statement = insertRecord();
  const write = db().transaction(() => {
    for (const change of real) {
      statement.run(
        subject.type,
        subject.id,
        subject.label,
        actor.userId,
        actor.label,
        "updated",
        change.field,
        change.from ?? null,
        change.to ?? null,
        at,
      );
    }
  });

  write();
  return real.length;
}

/**
 * Compares two objects field by field against a label map, so callers describe
 * *what* is editable and this decides what changed.
 */
export function diffFields<T extends Record<string, unknown>>(
  labels: Record<keyof T & string, string>,
  before: Partial<T>,
  after: T,
): FieldChange[] {
  return (Object.keys(labels) as (keyof T & string)[]).map((key) => ({
    field: labels[key],
    from: before[key] === null || before[key] === undefined ? null : String(before[key]),
    to: after[key] === null || after[key] === undefined ? null : String(after[key]),
  }));
}

/* ------------------------------------------------------------- one feed */

/**
 * A change to anything, from either audit table.
 *
 * `subject_type` is 'booking' for rows out of `event_audit`, so the reader can
 * tell a booking edit from a venue edit without the caller keeping two lists.
 */
export type ChangeRow = {
  id: number;
  subject_type: "booking" | SubjectType;
  subject_id: number | null;
  subject_label: string;
  actor_user_id: number | null;
  actor_label: string;
  action: string;
  field: string | null;
  old_value: string | null;
  new_value: string | null;
  at: string;
};

/**
 * Both audit tables share a shape once the column names are lined up, so the
 * union does the work and the sort is over the whole set rather than two
 * separately-sorted halves stapled together.
 */
const UNION = `
  SELECT id, 'booking' AS subject_type, event_id AS subject_id, event_label AS subject_label,
         actor_user_id, actor_label, action, field, old_value, new_value, at
    FROM event_audit
  UNION ALL
  SELECT id, subject_type, subject_id, subject_label,
         actor_user_id, actor_label, action, field, old_value, new_value, at
    FROM record_audit
`;

export function recentChanges(limit = 200): ChangeRow[] {
  return db()
    .prepare(`SELECT * FROM (${UNION}) ORDER BY at DESC, id DESC LIMIT ?`)
    .all(limit) as ChangeRow[];
}

export function changesBy(userId: number, limit = 60): ChangeRow[] {
  return db()
    .prepare(
      `SELECT * FROM (${UNION}) WHERE actor_user_id = ? ORDER BY at DESC, id DESC LIMIT ?`,
    )
    .all(userId, limit) as ChangeRow[];
}

/** Everything recorded about one subject — a staff record's own history. */
export function historyFor(subject: SubjectType, id: number, limit = 40): ChangeRow[] {
  return db()
    .prepare(
      `SELECT id, subject_type, subject_id, subject_label, actor_user_id, actor_label,
              action, field, old_value, new_value, at
         FROM record_audit
        WHERE subject_type = ? AND subject_id = ?
        ORDER BY at DESC, id DESC LIMIT ?`,
    )
    .all(subject, id, limit) as ChangeRow[];
}

/** How many edits each person has made, for the staff list. */
export function editCountsByActor(): Map<number, number> {
  const rows = db()
    .prepare(
      `SELECT actor_user_id AS id, COUNT(*) AS n FROM (${UNION})
        WHERE actor_user_id IS NOT NULL GROUP BY actor_user_id`,
    )
    .all() as { id: number; n: number }[];
  return new Map(rows.map((r) => [r.id, r.n]));
}

/**
 * One edit writes a row per changed field; for reading they belong back
 * together. Same idea as the booking history, over the combined feed.
 */
export type ChangeGroup = {
  key: string;
  at: string;
  actor_label: string;
  actor_user_id: number | null;
  action: string;
  subject_type: ChangeRow["subject_type"];
  subject_id: number | null;
  subject_label: string;
  changes: { field: string; old_value: string | null; new_value: string | null }[];
};

export function groupChanges(rows: ChangeRow[]): ChangeGroup[] {
  const groups: ChangeGroup[] = [];
  let current: ChangeGroup | null = null;

  for (const row of rows) {
    const key = `${row.subject_type}|${row.subject_id}|${row.at}|${row.actor_label}|${row.action}`;
    if (!current || current.key !== key) {
      current = {
        key,
        at: row.at,
        actor_label: row.actor_label,
        actor_user_id: row.actor_user_id,
        action: row.action,
        subject_type: row.subject_type,
        subject_id: row.subject_id,
        subject_label: row.subject_label,
        changes: [],
      };
      groups.push(current);
    }
    if (row.field) {
      current.changes.push({
        field: row.field,
        old_value: row.old_value,
        new_value: row.new_value,
      });
    }
  }

  return groups;
}

/** Reads as a sentence: "Edited Dana Poulin", "Added The Boulevard Club". */
export function describeAction(group: Pick<ChangeGroup, "action" | "subject_type">): string {
  const what =
    group.subject_type === "booking"
      ? "the booking"
      : group.subject_type === "staff"
        ? "a staff record"
        : group.subject_type === "venue"
          ? "a venue"
          : group.subject_type === "vehicle"
            ? "a vehicle"
            : "settings";

  switch (group.action) {
    case "created":
    case "added":
      return `Added ${what}`;
    case "updated":
      return `Edited ${what}`;
    case "deleted":
    case "removed":
      return `Deleted ${what}`;
    case "deactivated":
      return "Deactivated the account";
    case "reactivated":
      return "Reactivated the account";
    case "password_set":
      return "Set a new password";
    case "password_reset":
      return "Reset their own password";
    case "plan_link_rotated":
      return "Issued a new planner link";
    case "plan_submitted":
      return "Sent in their plan";
    default:
      return group.action.replace(/_/g, " ");
  }
}

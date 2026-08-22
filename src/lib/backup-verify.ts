import Database from "better-sqlite3";
import fs from "node:fs";
import { LATEST_VERSION } from "./migrations";

/**
 * Restore-testing for database backups.
 *
 * A backup nobody has ever restored is not a backup — it is a file. The nightly
 * timer used to write one and move on, so a subtly corrupt snapshot could have
 * sat there for a month looking like insurance.
 *
 * So every backup is opened and interrogated the moment it is written: the
 * pages are checked, the foreign keys are checked, the schema version has to
 * match what this build of Piper expects, and the queries the app actually runs
 * are run against it. That last one matters most — `integrity_check` passes on
 * a structurally sound database whose schema is a version too old to serve.
 */

export type Check = { name: string; ok: boolean; detail: string };
export type VerifyResult = { ok: boolean; checks: Check[]; counts: Record<string, number> };

/** Tables the app cannot function without. A backup missing any is a failure. */
const REQUIRED_TABLES = [
  "users",
  "sessions",
  "events",
  "venues",
  "songs",
  "timeline_items",
  "questionnaires",
  "entrance_order",
  "speeches",
  "recommendations",
  "crew_reports",
  "crew_aliases",
  "event_audit",
];

/**
 * Representative reads — one per area of the app. They are deliberately real
 * queries with joins rather than `SELECT 1`, because the failure being guarded
 * against is a schema that no longer matches the code.
 */
const SMOKE_QUERIES: { name: string; sql: string }[] = [
  { name: "sign-in lookup", sql: "SELECT id, email, role FROM users WHERE active = 1 LIMIT 1" },
  {
    name: "events with venue and DJ",
    sql: `SELECT e.id, e.event_date, v.name AS venue, u.name AS dj
          FROM events e
          LEFT JOIN venues v ON v.id = e.venue_id
          LEFT JOIN users u ON u.id = e.assigned_dj_id
          ORDER BY e.event_date LIMIT 5`,
  },
  {
    name: "a wedding's song list",
    sql: `SELECT s.category, s.title, s.cue FROM songs s
          JOIN events e ON e.id = s.event_id
          ORDER BY s.event_id, s.position LIMIT 5`,
  },
  {
    name: "planner answers",
    sql: `SELECT event_id, preferred_genres, avoid_genres, request_policy, mc_name
          FROM questionnaires LIMIT 1`,
  },
  {
    name: "crew report matching",
    sql: `SELECT job_norm, COUNT(*) FROM crew_reports
          WHERE is_test = 0 GROUP BY job_norm LIMIT 5`,
  },
  { name: "planner suggestions", sql: "SELECT category, title FROM recommendations LIMIT 5" },
  { name: "event history", sql: "SELECT event_id, action, field FROM event_audit LIMIT 5" },
];

function tablesIn(conn: Database.Database): Set<string> {
  const rows = conn
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
    .all() as { name: string }[];
  return new Set(rows.map((r) => r.name));
}

function countRows(conn: Database.Database, tables: Set<string>): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const table of REQUIRED_TABLES) {
    if (!tables.has(table)) continue;
    const row = conn.prepare(`SELECT COUNT(*) AS n FROM ${table}`).get() as { n: number };
    counts[table] = row.n;
  }
  return counts;
}

/**
 * Opens a backup read-only and proves it could serve the app.
 *
 * `live` is the current database's row counts, when available. A backup is
 * allowed to hold fewer rows than the live database (it is a snapshot, and
 * bookings have been made since) but never more — that would mean the file
 * isn't a snapshot of this system at all.
 */
export function verifyBackup(file: string, live?: Record<string, number>): VerifyResult {
  const checks: Check[] = [];
  const add = (name: string, ok: boolean, detail = "") => checks.push({ name, ok, detail });

  if (!fs.existsSync(file)) {
    return { ok: false, checks: [{ name: "file exists", ok: false, detail: file }], counts: {} };
  }

  const bytes = fs.statSync(file).size;
  add("file is not empty", bytes > 0, `${(bytes / 1024).toFixed(0)} KB`);
  if (bytes === 0) return { ok: false, checks, counts: {} };

  // readonly: verifying a backup must never be able to alter it.
  let conn: Database.Database;
  try {
    conn = new Database(file, { readonly: true, fileMustExist: true });
  } catch (error) {
    add("opens as a database", false, (error as Error).message);
    return { ok: false, checks, counts: {} };
  }

  let counts: Record<string, number> = {};
  try {
    add("opens as a database", true);

    /**
     * A corrupt database throws rather than answering. That is the normal case
     * here — a truncated copy or a rotted page raises SQLITE_CORRUPT from the
     * pragma itself — so every probe reports the throw as a failed check. An
     * operator reading a nightly timer's log needs "pages intact — FAIL", not
     * a stack trace.
     */
    const attempt = <T>(name: string, run: () => T, judge: (value: T) => [boolean, string]) => {
      try {
        const [ok, detail] = judge(run());
        add(name, ok, detail);
        return true;
      } catch (error) {
        add(name, false, (error as Error).message);
        return false;
      }
    };

    attempt(
      "pages intact",
      () => conn.pragma("integrity_check", { simple: true }),
      (v) => [v === "ok", String(v)],
    );

    attempt(
      "no orphaned rows",
      () => conn.pragma("foreign_key_check") as unknown[],
      (rows) => [rows.length === 0, `${rows.length} violation(s)`],
    );

    attempt(
      "schema version matches this build",
      () => Number(conn.pragma("user_version", { simple: true })),
      (v) => [v === LATEST_VERSION, `backup v${v}, expected v${LATEST_VERSION}`],
    );

    let tables = new Set<string>();
    const readable = attempt(
      "every table present",
      () => {
        tables = tablesIn(conn);
        return REQUIRED_TABLES.filter((t) => !tables.has(t));
      },
      (missing) => [missing.length === 0, missing.length ? missing.join(", ") : ""],
    );

    for (const query of SMOKE_QUERIES) {
      attempt(
        `query: ${query.name}`,
        () => conn.prepare(query.sql).all(),
        () => [true, ""],
      );
    }

    // Counting scans every page, so it only runs once the catalogue is readable.
    if (readable) {
      try {
        counts = countRows(conn, tables);
      } catch (error) {
        add("row counts readable", false, (error as Error).message);
      }
    }

    if (live) {
      const shrunk = Object.entries(counts).filter(([table, n]) => {
        const before = live[table];
        return before !== undefined && n > before;
      });
      add(
        "row counts consistent with live",
        shrunk.length === 0,
        shrunk.length
          ? shrunk.map(([t, n]) => `${t}: backup ${n} > live ${live[t]}`).join("; ")
          : Object.entries(counts)
              .map(([t, n]) => `${t} ${n}`)
              .join(", "),
      );
    }

    // An empty users table means nobody could sign in to the restored system.
    add("at least one user", (counts.users ?? 0) > 0, `${counts.users ?? 0} user(s)`);
  } finally {
    conn.close();
  }

  return { ok: checks.every((c) => c.ok), checks, counts };
}

export function formatResult(file: string, result: VerifyResult): string {
  const lines = [`Verifying ${file}`];
  for (const check of result.checks) {
    lines.push(`  ${check.ok ? "ok  " : "FAIL"}  ${check.name}${check.detail ? ` — ${check.detail}` : ""}`);
  }
  lines.push(result.ok ? "Backup restores clean." : "Backup FAILED verification.");
  return lines.join("\n");
}

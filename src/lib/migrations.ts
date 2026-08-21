/**
 * Schema migrations.
 *
 * `schema.sql` describes the database as it looks *today* and is used to create
 * a fresh one. It cannot alter a database that already exists — every statement
 * is `IF NOT EXISTS`, so a new column on an existing table would be skipped
 * silently and the app would then query a column that isn't there.
 *
 * So: a fresh database gets `schema.sql` and is stamped at LATEST. An existing
 * one runs each migration above its recorded version, in order, once.
 *
 * To change the schema: add the statement to `schema.sql` for new installs AND
 * add a migration here for existing ones. Never edit a released migration —
 * databases in the wild have already run it. Add a new one instead.
 */
export type Migration = { version: number; label: string; up: string };

export const MIGRATIONS: Migration[] = [
  {
    version: 1,
    label: "staff records on users",
    up: `
      ALTER TABLE users ADD COLUMN emergency_contact TEXT;
      ALTER TABLE users ADD COLUMN start_date TEXT;
      ALTER TABLE users ADD COLUMN gear TEXT;
      ALTER TABLE users ADD COLUMN staff_notes TEXT;
    `,
  },
  {
    version: 2,
    label: "crew reports, aliases and event job numbers",
    up: `
      CREATE TABLE IF NOT EXISTS crew_reports (
        id            INTEGER PRIMARY KEY AUTOINCREMENT,
        kind          TEXT NOT NULL CHECK (kind IN ('dj', 'warehouse')),
        report_type   TEXT,
        job_raw       TEXT NOT NULL,
        job_norm      TEXT NOT NULL,
        crew_raw      TEXT,
        sent_at       TEXT NOT NULL,
        vdp           TEXT,
        rating_client INTEGER,
        rating_crowd  INTEGER,
        rating_staff  INTEGER,
        quality       INTEGER,
        manifest      TEXT CHECK (manifest IN ('yes', 'no', 'na')),
        manifest_override TEXT CHECK (manifest_override IN ('yes', 'no')),
        notes         TEXT,
        is_test       INTEGER NOT NULL DEFAULT 0,
        source_id     TEXT,
        created_at    TEXT NOT NULL DEFAULT (datetime('now'))
      );
      CREATE UNIQUE INDEX IF NOT EXISTS idx_reports_dedupe ON crew_reports(kind, job_norm, sent_at);
      CREATE INDEX IF NOT EXISTS idx_reports_job ON crew_reports(job_norm);
      CREATE INDEX IF NOT EXISTS idx_reports_sent ON crew_reports(sent_at);

      CREATE TABLE IF NOT EXISTS crew_aliases (
        alias      TEXT PRIMARY KEY COLLATE NOCASE,
        canonical  TEXT NOT NULL,
        created_at TEXT NOT NULL DEFAULT (datetime('now'))
      );

      ALTER TABLE events ADD COLUMN job_number TEXT;
    `,
  },
];

export const LATEST_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);

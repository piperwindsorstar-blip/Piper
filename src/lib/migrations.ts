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
];

export const LATEST_VERSION = MIGRATIONS.reduce((max, m) => Math.max(max, m.version), 0);

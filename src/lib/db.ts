import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { LATEST_VERSION, MIGRATIONS } from "./migrations";
import { ensureStandingFleet } from "./fleet";

const DB_DIR = process.env.PIPER_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "piper.db");
const SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "schema.sql");

let instance: Database.Database | null = null;

function isFresh(conn: Database.Database): boolean {
  const row = conn
    .prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = 'users'")
    .get();
  return row === undefined;
}

/**
 * Brings the database up to date, whether it is brand new or predates the
 * current schema. Each migration runs in its own transaction, so a failing one
 * leaves the version untouched rather than half-applied.
 */
function migrate(conn: Database.Database): void {
  if (isFresh(conn)) {
    conn.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
    conn.pragma(`user_version = ${LATEST_VERSION}`);
    return;
  }

  // Migrations run BEFORE the schema file, and the order is load-bearing.
  //
  // schema.sql describes the database as it looks today, so it contains
  // indexes on columns that migrations add. Running it first against an older
  // database means CREATE INDEX hits a column that does not exist yet, throws,
  // and takes the whole connection down before a single migration has run —
  // leaving the install permanently stuck at its old version. That happened.
  const current = Number((conn.pragma("user_version", { simple: true }) as number) ?? 0);
  const pending = MIGRATIONS.filter((m) => m.version > current).sort((a, b) => a.version - b.version);

  for (const migration of pending) {
    const apply = conn.transaction(() => {
      conn.exec(migration.up);
      conn.pragma(`user_version = ${migration.version}`);
    });
    apply();
    console.log(`[piper] applied migration ${migration.version}: ${migration.label}`);
  }

  // Now safe: every column the schema references exists. This is belt and
  // braces for anything added to schema.sql without its own migration.
  conn.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
}

export function db(): Database.Database {
  if (instance) return instance;

  fs.mkdirSync(DB_DIR, { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  migrate(conn);

  // The standing fleet is established here rather than by the seed script,
  // so the board and the Gantt open on the same rows on every install —
  // including one whose database predates the fleet.
  ensureStandingFleet(conn);

  instance = conn;
  return instance;
}

export function nowIso(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

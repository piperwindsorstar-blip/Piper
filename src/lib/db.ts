import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import { LATEST_VERSION, MIGRATIONS } from "./migrations";

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

  // Older installs still need any tables added since they were created.
  conn.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));

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
}

export function db(): Database.Database {
  if (instance) return instance;

  fs.mkdirSync(DB_DIR, { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  migrate(conn);

  instance = conn;
  return instance;
}

export function nowIso(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

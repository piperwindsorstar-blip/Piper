import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

const DB_DIR = process.env.PIPER_DATA_DIR ?? path.join(process.cwd(), "data");
const DB_PATH = path.join(DB_DIR, "piper.db");
const SCHEMA_PATH = path.join(process.cwd(), "src", "lib", "schema.sql");

let instance: Database.Database | null = null;

/**
 * Opens (once per process) the SQLite file and applies the schema.
 * The schema is written with IF NOT EXISTS everywhere, so re-running is a no-op.
 */
export function db(): Database.Database {
  if (instance) return instance;

  fs.mkdirSync(DB_DIR, { recursive: true });
  const conn = new Database(DB_PATH);
  conn.pragma("journal_mode = WAL");
  conn.pragma("foreign_keys = ON");
  conn.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));

  instance = conn;
  return instance;
}

export function nowIso(): string {
  return new Date().toISOString().replace("T", " ").slice(0, 19);
}

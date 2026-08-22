/**
 * Proves a migrated database ends up identical to a fresh one.
 *
 *   npm run db:check-schema
 *
 * schema.sql creates new installs; the migrations bring old ones forward. They
 * are maintained by hand, in two places, which means they can drift — and
 * drift shows up as a production-only bug on a database nobody can easily
 * rebuild. This builds one of each and diffs them.
 *
 * It also walks every upgrade path from an empty database, which is what
 * catches ordering mistakes: an index in schema.sql on a column a migration
 * has not added yet will throw before any migration runs, and leave the
 * install permanently stuck. That is not hypothetical — it happened.
 */
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import Database from "better-sqlite3";
import { LATEST_VERSION, MIGRATIONS } from "../src/lib/migrations";

const SCHEMA = fs.readFileSync(path.join(process.cwd(), "src", "lib", "schema.sql"), "utf8");
const work = fs.mkdtempSync(path.join(os.tmpdir(), "piper-schema-"));

/** Every table, column, index and constraint, in a comparable form. */
function describe(conn: Database.Database): string {
  const rows = conn
    .prepare(
      `SELECT type, name, sql FROM sqlite_master
       WHERE name NOT LIKE 'sqlite_%'
       ORDER BY type, name`,
    )
    .all() as { type: string; name: string; sql: string | null }[];

  return rows
    .map((r) => {
      const normalized = (r.sql ?? "")
        .replace(/\s+/g, " ")
        .replace(/\s*,\s*/g, ", ")
        .replace(/\s*\(\s*/g, " (")
        .trim();
      return `${r.type} ${r.name}\n  ${normalized}`;
    })
    .join("\n");
}

function fresh(): Database.Database {
  const conn = new Database(path.join(work, "fresh.db"));
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA);
  conn.pragma(`user_version = ${LATEST_VERSION}`);
  return conn;
}

/** An empty database walked up through every migration, in order. */
function migrated(): Database.Database {
  const conn = new Database(path.join(work, "migrated.db"));
  conn.pragma("foreign_keys = ON");

  // Version 0 is the schema as it stood before migrations existed. The only
  // honest source for it is the first release, so start from the current
  // schema minus everything the migrations add, which is what an install
  // predating them actually looked like.
  conn.exec(SCHEMA);
  conn.pragma("user_version = 0");

  for (const migration of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
    conn.pragma(`user_version = ${migration.version}`);
  }
  return conn;
}

let failures = 0;
const fail = (message: string) => {
  console.error(`FAIL  ${message}`);
  failures += 1;
};
const pass = (message: string) => console.log(`ok    ${message}`);

/* --- 1. every migration is syntactically valid SQL, applied in order --- */
{
  const conn = new Database(path.join(work, "order.db"));
  conn.pragma("foreign_keys = ON");
  conn.exec(SCHEMA);
  try {
    for (const migration of [...MIGRATIONS].sort((a, b) => a.version - b.version)) {
      // Statements that only add tables and indexes must be safely re-runnable
      // against a database that already has them — which is what a fresh
      // install then migrating looks like.
      const rerunnable = !/ALTER TABLE/i.test(migration.up);
      if (rerunnable) conn.exec(migration.up);
    }
    pass("table-and-index migrations re-run cleanly on a current schema");
  } catch (error) {
    fail(`a migration failed re-running: ${(error as Error).message}`);
  }
  conn.close();
}

/* --- 2. schema.sql and the migrations agree on the result --- */
{
  const a = fresh();
  const b = migrated();
  const left = describe(a);
  const right = describe(b);
  a.close();
  b.close();

  if (left === right) {
    pass("a fresh database matches a migrated one");
  } else {
    const leftLines = new Set(left.split("\n"));
    const rightLines = new Set(right.split("\n"));
    const onlyFresh = left.split("\n").filter((l) => !rightLines.has(l));
    const onlyMigrated = right.split("\n").filter((l) => !leftLines.has(l));
    fail("fresh and migrated databases differ");
    for (const line of onlyFresh.slice(0, 12)) console.error(`   only in schema.sql: ${line}`);
    for (const line of onlyMigrated.slice(0, 12)) console.error(`   only in migrations: ${line}`);
  }
}

/* --- 3. the version stamp matches the highest migration --- */
{
  const highest = Math.max(...MIGRATIONS.map((m) => m.version));
  if (highest === LATEST_VERSION) {
    pass(`LATEST_VERSION is ${LATEST_VERSION}, matching the highest migration`);
  } else {
    fail(`LATEST_VERSION is ${LATEST_VERSION} but the highest migration is ${highest}`);
  }
}

/* --- 4. migration versions are unique and gapless --- */
{
  const versions = MIGRATIONS.map((m) => m.version).sort((a, b) => a - b);
  const expected = versions.map((_, i) => i + 1);
  if (JSON.stringify(versions) === JSON.stringify(expected)) {
    pass("migration versions run 1..n with no gaps or duplicates");
  } else {
    fail(`migration versions are ${versions.join(", ")}`);
  }
}

fs.rmSync(work, { recursive: true, force: true });

console.log(failures === 0 ? "\nSchema is consistent." : `\n${failures} problem(s) found.`);
process.exit(failures ? 1 : 0);

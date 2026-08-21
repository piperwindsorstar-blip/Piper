/**
 * Wipes the database and reseeds the demo season.
 *
 *   npm run db:reset
 *
 * This is a development convenience and it destroys everything. It refuses to
 * run when NODE_ENV=production, and refuses when the database holds data that
 * doesn't look like the demo seed — a real booking or an imported crew report
 * means this is somebody's live system.
 *
 * `--force` overrides the data check (never the production check). If you
 * genuinely need to reset a live database, take a backup first:
 *   npm run db:backup
 */
import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";
import Database from "better-sqlite3";

const force = process.argv.includes("--force");
const dataDir = process.env.PIPER_DATA_DIR ?? path.join(process.cwd(), "data");
const dbPath = path.join(dataDir, "piper.db");

if (process.env.NODE_ENV === "production") {
  console.error("Refusing to reset: NODE_ENV=production.");
  console.error("This would delete every booking. There is no --force for this.");
  process.exit(1);
}

if (fs.existsSync(dbPath) && !force) {
  const conn = new Database(dbPath, { readonly: true });
  const count = (sql: string): number => {
    try {
      return (conn.prepare(sql).get() as { n: number }).n;
    } catch {
      return 0; // table not created yet
    }
  };

  // The seed plants exactly 5 events and no crew reports.
  const events = count("SELECT COUNT(*) AS n FROM events");
  const reports = count("SELECT COUNT(*) AS n FROM crew_reports");
  conn.close();

  if (events > 5 || reports > 0) {
    console.error("Refusing to reset: this database holds data beyond the demo seed.");
    console.error(`  events: ${events} (demo seed plants 5)`);
    console.error(`  crew reports: ${reports} (demo seed plants none)`);
    console.error("");
    console.error("Take a backup first:  npm run db:backup");
    console.error("Then, if you are certain:  npm run db:reset -- --force");
    process.exit(1);
  }
}

for (const suffix of ["", "-shm", "-wal"]) {
  const file = dbPath + suffix;
  if (fs.existsSync(file)) fs.unlinkSync(file);
}

const seed = spawnSync("npx", ["tsx", "scripts/seed.ts"], { stdio: "inherit" });
process.exit(seed.status ?? 0);

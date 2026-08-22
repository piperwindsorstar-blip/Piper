/**
 * Takes a consistent snapshot of the database.
 *
 *   npm run db:backup            # writes to ./backups
 *   npm run db:backup -- /var/backups/piper
 *
 * Uses SQLite's VACUUM INTO rather than copying the file. Piper runs in WAL
 * mode, so a plain `cp` while the server is running can capture a database
 * without its write-ahead log — a backup that looks fine and restores missing
 * the most recent bookings. VACUUM INTO produces a single settled file.
 *
 * Every backup is restore-tested the moment it is written, and a backup that
 * fails verification exits non-zero so the nightly timer reports as failed
 * rather than logging success over a broken file.
 */
import fs from "node:fs";
import path from "node:path";
import { db } from "../src/lib/db";
import { formatResult, verifyBackup } from "../src/lib/backup-verify";

const KEEP = Number(process.env.PIPER_BACKUP_KEEP ?? 30);
const dir = process.argv[2] ?? path.join(process.cwd(), "backups");

fs.mkdirSync(dir, { recursive: true });

const stamp = new Date().toISOString().replace(/[:.]/g, "-").slice(0, 19);
const target = path.join(dir, `piper-${stamp}.db`);

// VACUUM INTO refuses to overwrite, which is the behaviour we want.
db().exec(`VACUUM INTO '${target.replace(/'/g, "''")}'`);

const size = fs.statSync(target).size;
console.log(`Backed up to ${target} (${(size / 1024).toFixed(0)} KB)`);

// Restore-test it now, against the live database it was taken from.
const live = Object.fromEntries(
  (
    db()
      .prepare("SELECT name FROM sqlite_master WHERE type = 'table'")
      .all() as { name: string }[]
  ).map(({ name }) => [
    name,
    (db().prepare(`SELECT COUNT(*) AS n FROM ${name}`).get() as { n: number }).n,
  ]),
);

const result = verifyBackup(target, live);
console.log(formatResult(target, result));

if (!result.ok) {
  // Leave the file for inspection — deleting the evidence helps nobody.
  console.error(`\nKept at ${target} so the failure can be inspected.`);
  process.exit(1);
}

// Keep the most recent N, so a nightly timer can't quietly fill the disk.
const existing = fs
  .readdirSync(dir)
  .filter((name) => /^piper-.*\.db$/.test(name))
  .sort()
  .reverse();

for (const stale of existing.slice(KEEP)) {
  fs.unlinkSync(path.join(dir, stale));
  console.log(`Removed old backup ${stale}`);
}

console.log(`${Math.min(existing.length, KEEP)} backup(s) retained in ${dir}`);

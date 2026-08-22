/**
 * Restore-tests a backup on demand.
 *
 *   npm run db:verify-backup                       # newest in ./backups
 *   npm run db:verify-backup -- /var/backups/piper # newest in that directory
 *   npm run db:verify-backup -- /path/to/one.db    # that exact file
 *
 * Exits non-zero if the backup would not serve the app, so it can be used as a
 * check in a timer or before relying on a snapshot.
 */
import fs from "node:fs";
import path from "node:path";
import { formatResult, verifyBackup } from "../src/lib/backup-verify";

const arg = process.argv[2] ?? path.join(process.cwd(), "backups");

if (!fs.existsSync(arg)) {
  console.error(`No such file or directory: ${arg}`);
  console.error("Run `npm run db:backup` first, or pass the backup directory.");
  process.exit(1);
}

let file = arg;
if (fs.statSync(arg).isDirectory()) {
  const backups = fs
    .readdirSync(arg)
    .filter((name) => /^piper-.*\.db$/.test(name))
    .sort()
    .reverse();

  if (backups.length === 0) {
    console.error(`No backups in ${arg}.`);
    process.exit(1);
  }
  file = path.join(arg, backups[0]);
  console.log(`Newest of ${backups.length} backup(s) in ${arg}\n`);
}

const result = verifyBackup(file);
console.log(formatResult(file, result));

if (result.ok) {
  const counts = Object.entries(result.counts)
    .filter(([, n]) => n > 0)
    .map(([table, n]) => `${n} ${table}`)
    .join(", ");
  console.log(`Holds: ${counts || "no rows"}`);
}

process.exit(result.ok ? 0 : 1);

/**
 * Imports crew reports from a JSON file (or stdin) into the database.
 *
 *   npm run import:reports -- reports.json
 *   cat reports.json | npm run import:reports
 *
 * Expected shape: { "reports": [ { kind, job, sentAt, ... }, ... ] }
 * See src/lib/report-import.ts for the full field list. Re-running the same
 * file is safe — reports are deduped on (kind, job number, sent time).
 */
import fs from "node:fs";
import { importReports, importSchema } from "../src/lib/report-import";

const file = process.argv[2];
const raw = file ? fs.readFileSync(file, "utf8") : fs.readFileSync(0, "utf8");

let payload: unknown;
try {
  payload = JSON.parse(raw);
} catch (error) {
  console.error("Input is not valid JSON:", (error as Error).message);
  process.exit(1);
}

const parsed = importSchema.safeParse(payload);
if (!parsed.success) {
  console.error("Invalid payload:");
  for (const issue of parsed.error.issues.slice(0, 10)) {
    console.error(`  ${issue.path.join(".")}: ${issue.message}`);
  }
  process.exit(1);
}

const result = importReports(parsed.data.reports);
console.log(
  `Received ${result.received} · inserted ${result.inserted} · duplicates ${result.duplicates} · tests ${result.tests}`,
);
for (const rejected of result.rejected) {
  console.warn(`  rejected #${rejected.index}: ${rejected.reason}`);
}

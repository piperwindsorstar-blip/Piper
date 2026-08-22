import { z } from "zod";
import { db } from "./db";
import { looksLikeTest, normalizeJob } from "./reports";
import { resolveVenue } from "./venue-reports";

/**
 * Import contract for crew reports.
 *
 * Values come from parsed email text, so every field is coerced leniently:
 * ratings arrive as "5 - Amazing", manifest as "Yes"/"No"/absent. Anything
 * unparseable becomes null rather than failing the whole batch — one malformed
 * report should never block the rest of a night's imports.
 */

/** "5 - Amazing" -> 5, 5 -> 5, "" -> null. */
const rating = z
  .union([z.number(), z.string(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === null || v === undefined || v === "") return null;
    const match = String(v).match(/\d+/);
    if (!match) return null;
    const n = Number(match[0]);
    return n >= 1 && n <= 5 ? n : null;
  });

const manifest = z
  .union([z.string(), z.boolean(), z.null(), z.undefined()])
  .transform((v) => {
    if (v === true) return "yes" as const;
    if (v === false) return "no" as const;
    if (v === null || v === undefined) return "na" as const;
    const s = String(v).trim().toLowerCase();
    if (s === "yes" || s === "y" || s === "true" || s === "signed") return "yes" as const;
    if (s === "no" || s === "n" || s === "false") return "no" as const;
    return "na" as const;
  });

const text = z
  .union([z.string(), z.null(), z.undefined()])
  .transform((v) => (v === null || v === undefined || String(v).trim() === "" ? null : String(v).trim()));

export const reportSchema = z.object({
  kind: z.enum(["dj", "warehouse"]),
  reportType: text,
  job: z.string().min(1, "job number is required"),
  crew: text,
  /** UTC. Gmail hands back UTC; converting for display is the UI's job. */
  sentAt: z.string().min(1, "sentAt is required"),
  vdp: text,
  client: rating,
  crowd: rating,
  staff: rating,
  quality: rating,
  manifest: manifest,
  notes: text,
  /** Venue as the crew typed it. Matched to a venue record on the way in. */
  venue: text,
  sourceId: text,
  /** Force a row's test flag; otherwise it's detected from the job number. */
  isTest: z.boolean().optional(),
});

export const importSchema = z.object({ reports: z.array(reportSchema) });

export type ReportInput = z.infer<typeof reportSchema>;

export type ImportResult = {
  received: number;
  inserted: number;
  duplicates: number;
  tests: number;
  rejected: { index: number; reason: string }[];
};

/** Normalises a send time to 'YYYY-MM-DDTHH:MM:SSZ' so dedupe keys line up. */
function normalizeSentAt(raw: string): string | null {
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return null;
  return `${parsed.toISOString().slice(0, 19)}Z`;
}

/**
 * Files a batch of reports. Dedupe is (kind, job_norm, sent_at), matching the
 * key the tracker has always used — re-importing the same mailbox window is a
 * no-op rather than a pile of duplicates.
 */
export function importReports(inputs: ReportInput[]): ImportResult {
  const result: ImportResult = {
    received: inputs.length,
    inserted: 0,
    duplicates: 0,
    tests: 0,
    rejected: [],
  };

  const insert = db().prepare(
    `INSERT OR IGNORE INTO crew_reports
       (kind, report_type, job_raw, job_norm, crew_raw, sent_at, vdp,
        rating_client, rating_crowd, rating_staff, quality, manifest, notes, is_test, source_id,
        venue_raw, venue_id)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
  );

  const run = db().transaction(() => {
    inputs.forEach((input, index) => {
      const sentAt = normalizeSentAt(input.sentAt);
      if (!sentAt) {
        result.rejected.push({ index, reason: `unparseable sentAt: ${input.sentAt}` });
        return;
      }

      const jobNorm = normalizeJob(input.job);
      if (!jobNorm) {
        result.rejected.push({ index, reason: "empty job number" });
        return;
      }

      const isTest = input.isTest ?? looksLikeTest(input.job, input.crew, input.notes);

      const info = insert.run(
        input.kind,
        input.reportType,
        input.job.trim(),
        jobNorm,
        input.crew,
        sentAt,
        input.vdp,
        input.client,
        input.crowd,
        input.staff,
        input.quality,
        input.manifest,
        input.notes,
        isTest ? 1 : 0,
        input.sourceId,
        input.venue,
        resolveVenue(input.venue),
      );

      if (info.changes === 0) result.duplicates += 1;
      else {
        result.inserted += 1;
        if (isTest) result.tests += 1;
      }
    });
  });

  run();
  return result;
}

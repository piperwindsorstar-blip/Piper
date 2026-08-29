"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth";
import { parseReportEmail } from "@/lib/report-email";
import { importReports } from "@/lib/report-import";

export type ForwardState = {
  error?: string;
  ok?: string;
  /** What Piper read, shown back before and after filing. */
  fields?: { label: string; value: string }[];
  warnings?: string[];
  /** Kept so a rejected paste doesn't empty the box. */
  raw?: string;
};

/**
 * Reads a pasted forward and files it.
 *
 * One step rather than a preview and then a confirm. Filing is already
 * idempotent — the importer dedupes on kind, job and send time — so the worst
 * a second paste can do is nothing, and a confirm screen would buy safety
 * that was already there at the cost of a click every single time.
 *
 * What it read is shown back either way, so a wrong job number is visible
 * rather than discovered a month later in the stats.
 */
export async function fileForwardedReport(
  _prev: ForwardState,
  formData: FormData,
): Promise<ForwardState> {
  await requireArea("reports", "edit");

  const raw = String(formData.get("raw") ?? "");
  const parsed = parseReportEmail(raw);
  if (!parsed.ok) return { error: parsed.reason, raw };

  const { report, fields, warnings } = parsed.parsed;
  const result = importReports([report]);

  revalidatePath("/reports");
  revalidatePath("/reports/dj");
  revalidatePath("/reports/warehouse");

  if (result.inserted > 0) {
    return { ok: `Filed the ${report.kind === "dj" ? "DJ" : "warehouse"} report for job ${report.job}.`, fields, warnings };
  }
  if (result.duplicates > 0) {
    return {
      ok: `Already filed — job ${report.job} was imported before. Nothing was duplicated.`,
      fields,
      warnings,
    };
  }
  if (result.tests > 0) {
    return { ok: `Filed as a test entry, because job ${report.job} looks like one.`, fields, warnings };
  }

  return {
    error: result.rejected[0]?.reason ?? "Piper read the email but could not file it.",
    fields,
    raw,
  };
}

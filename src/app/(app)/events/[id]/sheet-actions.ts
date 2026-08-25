"use server";

import { revalidatePath } from "next/cache";
import { requireArea } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import { readPlannerWorkbook } from "@/lib/planner-sheet";
import { describeMerge, mergeSheet } from "@/lib/sheet-merge";

export type UploadState = { error?: string; ok?: string };

/** Ten megabytes is far more than a planner ever needs, and small enough that
 *  a wrong file cannot exhaust the server's memory. */
const MAX_BYTES = 10 * 1024 * 1024;

const XLSX_TYPES = new Set([
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.ms-excel",
  "application/octet-stream", // some browsers and phones send this
]);

/**
 * Takes a filled-in planner spreadsheet and folds it into the booking.
 *
 * Admin-only: a couple sends the file to the office rather than uploading it
 * themselves, and letting an unauthenticated upload rewrite a booking would
 * be a hole with no upside.
 */
export async function uploadSheet(
  _prev: UploadState,
  formData: FormData,
): Promise<UploadState> {
  const admin = await requireArea("weddings", "edit");

  const eventId = Number(formData.get("event_id"));
  const file = formData.get("sheet");

  if (!Number.isInteger(eventId)) return { error: "Which booking is this for?" };
  if (!(file instanceof File) || file.size === 0) {
    return { error: "Choose the spreadsheet to import." };
  }
  if (file.size > MAX_BYTES) {
    return { error: "That file is larger than 10 MB — it probably isn't a planner." };
  }
  if (file.type && !XLSX_TYPES.has(file.type) && !file.name.toLowerCase().endsWith(".xlsx")) {
    return { error: "That needs to be an .xlsx file. Export it from Excel or Google Sheets first." };
  }

  const event = getEvent(admin, eventId);
  if (!event) return { error: "That booking no longer exists." };

  let contents;
  try {
    contents = await readPlannerWorkbook(Buffer.from(await file.arrayBuffer()));
  } catch {
    return {
      error:
        "Piper couldn't read that file. It needs to be the planner workbook — " +
        "download a fresh one, fill that in, and upload it back.",
    };
  }

  const nothingFound =
    contents.songs.length === 0 &&
    Object.keys(contents.questionnaire).length === 0 &&
    contents.entrances.length === 0 &&
    contents.speeches.length === 0;

  if (nothingFound) {
    return {
      error:
        "That file opened, but nothing in it matched the planner layout. Check the " +
        "Activity column still has the original slot names — that's how the rows are read.",
    };
  }

  const report = mergeSheet(eventId, contents);

  revalidatePath(`/events/${eventId}`);
  revalidatePath(`/events/${eventId}/music`);
  revalidatePath(`/plan/${event.plan_token}`);
  return { ok: describeMerge(report) };
}

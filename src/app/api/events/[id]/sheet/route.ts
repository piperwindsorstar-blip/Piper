import { requireUser } from "@/lib/auth";
import { getEvent } from "@/lib/events";
import {
  entranceOrder,
  getQuestionnaire,
  songsForEvent,
  speeches,
} from "@/lib/planning";
import { buildPlannerWorkbook, sheetFilename } from "@/lib/planner-sheet";

/**
 * Downloads a booking's plan as a spreadsheet.
 *
 * Scoped like every other view of an event: `getEvent` returns nothing for a
 * DJ who isn't on it, so an unauthorised id is a 404 rather than a download.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const user = await requireUser();
  const { id } = await params;

  const eventId = Number(id);
  if (!Number.isInteger(eventId)) {
    return new Response("Not found", { status: 404 });
  }

  const event = getEvent(user, eventId);
  if (!event) return new Response("Not found", { status: 404 });

  const workbook = await buildPlannerWorkbook(
    event,
    songsForEvent(eventId).map((s) => ({
      category: s.category,
      title: s.title,
      artist: s.artist,
      cue: s.cue,
      link: s.link,
    })),
    getQuestionnaire(eventId) ?? {},
    entranceOrder(eventId).map((e) => ({ role: e.role, names: e.names ?? "" })),
    speeches(eventId).map((s) => ({
      who: s.who,
      when_text: s.when_text,
      song_title: s.song_title,
    })),
  );

  return new Response(new Uint8Array(workbook), {
    headers: {
      "content-type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      // The filename carries an em dash and the couple's names, so it has to be
      // encoded — a bare non-ASCII filename is dropped by some browsers.
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(sheetFilename(event))}`,
      "cache-control": "no-store",
    },
  });
}

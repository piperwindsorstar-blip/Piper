import { db } from "./db";
import {
  QUESTIONNAIRE_FIELDS,
  addSong,
  getQuestionnaire,
  replaceEntranceOrder,
  replaceSpeeches,
  saveQuestionnaire,
  songsForEvent,
  type QuestionnaireInput,
} from "./planning";
import { SONG_CATEGORIES } from "./types";
import type { SheetContents } from "./planner-sheet";

/**
 * Folding an uploaded spreadsheet back into a booking.
 *
 * Merge, never replace. A couple who downloads the workbook, fills in three
 * songs and uploads it has not asked to delete everything else — so a blank
 * cell means "nothing to say here", not "remove what you have". The only
 * things replaced wholesale are the entrance order and the speech list, and
 * only when the sheet actually has rows for them, because those are ordered
 * lists where a partial merge would produce nonsense.
 *
 * Songs already on the booking are matched on title so re-uploading the same
 * sheet does not duplicate them. Single-song slots keep the sheet's answer;
 * multi-song slots gain anything new.
 */

export type MergeReport = {
  songsAdded: number;
  songsUpdated: number;
  songsUnchanged: number;
  detailsFilled: number;
  entrances: number;
  speeches: number;
  ignored: string[];
};

const SINGLE = new Set(SONG_CATEGORIES.filter((c) => c.single).map((c) => c.key));
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");

export function mergeSheet(eventId: number, sheet: SheetContents): MergeReport {
  const report: MergeReport = {
    songsAdded: 0,
    songsUpdated: 0,
    songsUnchanged: 0,
    detailsFilled: 0,
    entrances: 0,
    speeches: 0,
    ignored: [],
  };

  const run = db().transaction(() => {
    /* ---- songs ---- */
    // Only the fields the merge compares — a placeholder for a just-inserted
    // row does not need to pretend to be a whole Song.
    type Placed = { id: number; title: string; artist: string | null; cue: string | null; link: string | null };

    const byCategory = new Map<string, Placed[]>();
    for (const song of songsForEvent(eventId)) {
      const list = byCategory.get(song.category) ?? [];
      list.push(song);
      byCategory.set(song.category, list);
    }

    const update = db().prepare(
      "UPDATE songs SET title = ?, artist = ?, cue = ?, link = ? WHERE id = ? AND event_id = ?",
    );

    for (const song of sheet.songs) {
      const inSlot = byCategory.get(song.category) ?? [];
      const sameTitle = inSlot.find((s) => norm(s.title) === norm(song.title));

      if (sameTitle) {
        // Same song, possibly with a cue or link added in the sheet.
        const changed =
          (sameTitle.artist ?? "") !== (song.artist ?? "") ||
          (sameTitle.cue ?? "") !== (song.cue ?? "") ||
          (sameTitle.link ?? "") !== (song.link ?? "");
        if (changed) {
          update.run(song.title, song.artist, song.cue, song.link, sameTitle.id, eventId);
          report.songsUpdated += 1;
        } else {
          report.songsUnchanged += 1;
        }
        continue;
      }

      if (SINGLE.has(song.category) && inSlot.length > 0) {
        // One song fits here and there is already one. The sheet wins — the
        // couple just told us what they want — but the old one is replaced
        // rather than sitting alongside it.
        update.run(song.title, song.artist, song.cue, song.link, inSlot[0].id, eventId);
        report.songsUpdated += 1;
        inSlot[0] = { ...inSlot[0], title: song.title, artist: song.artist, cue: song.cue, link: song.link };
        continue;
      }

      addSong({
        event_id: eventId,
        category: song.category,
        title: song.title,
        artist: song.artist,
        cue: song.cue,
        link: song.link,
        notes: null,
        // The couple filled the sheet in, so it counts as theirs — the music
        // page badges client picks differently from ones the office added.
        source: "client",
      });
      inSlot.push({ id: -1, title: song.title, artist: song.artist, cue: song.cue, link: song.link });
      byCategory.set(song.category, inSlot);
      report.songsAdded += 1;
    }

    /* ---- details: only fill what the sheet answers ---- */
    const current = getQuestionnaire(eventId);
    const merged = {} as QuestionnaireInput;
    for (const field of QUESTIONNAIRE_FIELDS) {
      const fromSheet = sheet.questionnaire[field];
      const existingValue = (current?.[field] as string | null) ?? null;
      if (fromSheet && fromSheet !== existingValue) {
        merged[field] = fromSheet as never;
        report.detailsFilled += 1;
      } else {
        merged[field] = existingValue as never;
      }
    }
    if (report.detailsFilled > 0 || current === null) {
      saveQuestionnaire(eventId, merged);
    }

    /* ---- ordered lists: replaced only when the sheet has rows ---- */
    const entrances = sheet.entrances.filter((e) => e.role || e.names);
    if (entrances.length > 0) {
      replaceEntranceOrder(eventId, entrances);
      report.entrances = entrances.length;
    }

    const speeches = sheet.speeches.filter((s) => s.who);
    if (speeches.length > 0) {
      replaceSpeeches(
        eventId,
        speeches.map((s) => ({
          who: s.who,
          when_text: s.when_text,
          song_title: s.song_title,
          song_artist: null,
          song_cue: null,
        })),
      );
      report.speeches = speeches.length;
    }
  });

  run();
  return report;
}

/** A sentence a person can read, rather than a pile of counts. */
export function describeMerge(report: MergeReport): string {
  const bits: string[] = [];
  if (report.songsAdded) bits.push(`${report.songsAdded} song${report.songsAdded === 1 ? "" : "s"} added`);
  if (report.songsUpdated) bits.push(`${report.songsUpdated} updated`);
  if (report.songsUnchanged) bits.push(`${report.songsUnchanged} already there`);
  if (report.detailsFilled) bits.push(`${report.detailsFilled} answer${report.detailsFilled === 1 ? "" : "s"} filled in`);
  if (report.entrances) bits.push(`${report.entrances} in the entrance order`);
  if (report.speeches) bits.push(`${report.speeches} speech${report.speeches === 1 ? "" : "es"}`);

  return bits.length > 0 ? `Imported: ${bits.join(", ")}.` : "Nothing new in that sheet.";
}

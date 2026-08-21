import { db, nowIso } from "./db";
import type { Questionnaire, Song, TimelineItem } from "./types";

/* ----------------------------------------------------------------- songs */

export function songsForEvent(eventId: number): Song[] {
  return db()
    .prepare("SELECT * FROM songs WHERE event_id = ? ORDER BY position ASC, id ASC")
    .all(eventId) as Song[];
}

export function songsByCategory(eventId: number): Map<string, Song[]> {
  const grouped = new Map<string, Song[]>();
  for (const song of songsForEvent(eventId)) {
    const list = grouped.get(song.category) ?? [];
    list.push(song);
    grouped.set(song.category, list);
  }
  return grouped;
}

export type SongInput = {
  event_id: number;
  category: string;
  title: string;
  artist: string | null;
  notes: string | null;
  source: "team" | "client";
};

export function addSong(input: SongInput): number {
  const next = db()
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM songs WHERE event_id = ? AND category = ?")
    .get(input.event_id, input.category) as { pos: number };

  const result = db()
    .prepare(
      `INSERT INTO songs (event_id, category, title, artist, notes, position, source)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(input.event_id, input.category, input.title, input.artist, input.notes, next.pos, input.source);
  return Number(result.lastInsertRowid);
}

/**
 * Single-song slots (first dance, last dance…) hold one entry: setting a new
 * one replaces whatever was there rather than stacking a second row.
 */
export function setSingleSong(input: SongInput): void {
  db().prepare("DELETE FROM songs WHERE event_id = ? AND category = ?").run(input.event_id, input.category);
  if (input.title.trim()) addSong(input);
}

export function deleteSong(id: number, eventId: number): void {
  db().prepare("DELETE FROM songs WHERE id = ? AND event_id = ?").run(id, eventId);
}

export function moveSong(id: number, eventId: number, direction: -1 | 1): void {
  const song = db()
    .prepare("SELECT * FROM songs WHERE id = ? AND event_id = ?")
    .get(id, eventId) as Song | undefined;
  if (!song) return;

  const neighbour = db()
    .prepare(
      direction === -1
        ? `SELECT * FROM songs WHERE event_id = ? AND category = ? AND position < ?
           ORDER BY position DESC LIMIT 1`
        : `SELECT * FROM songs WHERE event_id = ? AND category = ? AND position > ?
           ORDER BY position ASC LIMIT 1`,
    )
    .get(song.event_id, song.category, song.position) as Song | undefined;
  if (!neighbour) return;

  const swap = db().transaction(() => {
    db().prepare("UPDATE songs SET position = ? WHERE id = ?").run(neighbour.position, song.id);
    db().prepare("UPDATE songs SET position = ? WHERE id = ?").run(song.position, neighbour.id);
  });
  swap();
}

/* -------------------------------------------------------------- timeline */

export function timelineForEvent(eventId: number): TimelineItem[] {
  return db()
    .prepare("SELECT * FROM timeline_items WHERE event_id = ? ORDER BY position ASC, id ASC")
    .all(eventId) as TimelineItem[];
}

export type TimelineInput = {
  event_id: number;
  start_time: string | null;
  title: string;
  notes: string | null;
};

export function addTimelineItem(input: TimelineInput): number {
  const next = db()
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM timeline_items WHERE event_id = ?")
    .get(input.event_id) as { pos: number };

  const result = db()
    .prepare(
      "INSERT INTO timeline_items (event_id, start_time, title, notes, position) VALUES (?, ?, ?, ?, ?)",
    )
    .run(input.event_id, input.start_time, input.title, input.notes, next.pos);
  return Number(result.lastInsertRowid);
}

export function updateTimelineItem(id: number, eventId: number, input: TimelineInput): void {
  db()
    .prepare(
      "UPDATE timeline_items SET start_time = ?, title = ?, notes = ? WHERE id = ? AND event_id = ?",
    )
    .run(input.start_time, input.title, input.notes, id, eventId);
}

export function deleteTimelineItem(id: number, eventId: number): void {
  db().prepare("DELETE FROM timeline_items WHERE id = ? AND event_id = ?").run(id, eventId);
}

export function moveTimelineItem(id: number, eventId: number, direction: -1 | 1): void {
  const item = db()
    .prepare("SELECT * FROM timeline_items WHERE id = ? AND event_id = ?")
    .get(id, eventId) as TimelineItem | undefined;
  if (!item) return;

  const neighbour = db()
    .prepare(
      direction === -1
        ? "SELECT * FROM timeline_items WHERE event_id = ? AND position < ? ORDER BY position DESC LIMIT 1"
        : "SELECT * FROM timeline_items WHERE event_id = ? AND position > ? ORDER BY position ASC LIMIT 1",
    )
    .get(eventId, item.position) as TimelineItem | undefined;
  if (!neighbour) return;

  const swap = db().transaction(() => {
    db().prepare("UPDATE timeline_items SET position = ? WHERE id = ?").run(neighbour.position, item.id);
    db().prepare("UPDATE timeline_items SET position = ? WHERE id = ?").run(item.position, neighbour.id);
  });
  swap();
}

/** A reception running order most weddings start from, seeded on request. */
export const DEFAULT_TIMELINE: { start_time: string | null; title: string }[] = [
  { start_time: null, title: "Load in and sound check" },
  { start_time: null, title: "Guests arrive / prelude music" },
  { start_time: null, title: "Ceremony" },
  { start_time: null, title: "Cocktail hour" },
  { start_time: null, title: "Guests seated for dinner" },
  { start_time: null, title: "Grand entrance" },
  { start_time: null, title: "First dance" },
  { start_time: null, title: "Welcome toast" },
  { start_time: null, title: "Dinner service" },
  { start_time: null, title: "Speeches" },
  { start_time: null, title: "Parent dances" },
  { start_time: null, title: "Cake cutting" },
  { start_time: null, title: "Open dancing" },
  { start_time: null, title: "Last dance" },
  { start_time: null, title: "Guest send-off / load out" },
];

export function seedDefaultTimeline(eventId: number): void {
  const insert = db().transaction(() => {
    for (const item of DEFAULT_TIMELINE) {
      addTimelineItem({ event_id: eventId, start_time: item.start_time, title: item.title, notes: null });
    }
  });
  insert();
}

/* --------------------------------------------------------- questionnaire */

export function getQuestionnaire(eventId: number): Questionnaire | null {
  return (
    (db().prepare("SELECT * FROM questionnaires WHERE event_id = ?").get(eventId) as
      | Questionnaire
      | undefined) ?? null
  );
}

export type QuestionnaireInput = Omit<Questionnaire, "event_id" | "updated_at">;

export function saveQuestionnaire(eventId: number, input: QuestionnaireInput): void {
  db()
    .prepare(
      `INSERT INTO questionnaires
         (event_id, preferred_genres, avoid_genres, vibe_notes, announcements,
          wedding_party, mic_needs, takes_requests, contact_on_day, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(event_id) DO UPDATE SET
         preferred_genres = excluded.preferred_genres,
         avoid_genres     = excluded.avoid_genres,
         vibe_notes       = excluded.vibe_notes,
         announcements    = excluded.announcements,
         wedding_party    = excluded.wedding_party,
         mic_needs        = excluded.mic_needs,
         takes_requests   = excluded.takes_requests,
         contact_on_day   = excluded.contact_on_day,
         updated_at       = excluded.updated_at`,
    )
    .run(
      eventId,
      input.preferred_genres,
      input.avoid_genres,
      input.vibe_notes,
      input.announcements,
      input.wedding_party,
      input.mic_needs,
      input.takes_requests,
      input.contact_on_day,
      nowIso(),
    );
}

export function markPlanSubmitted(eventId: number): void {
  db().prepare("UPDATE events SET plan_submitted_at = ?, updated_at = ? WHERE id = ?").run(
    nowIso(),
    nowIso(),
    eventId,
  );
}

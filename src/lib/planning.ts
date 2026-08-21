import { db, nowIso } from "./db";
import type { EntranceEntry, Questionnaire, Recommendation, Song, SpeechEntry, TimelineItem } from "./types";

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
  cue: string | null;
  link: string | null;
  notes: string | null;
  source: "team" | "client";
};

export function addSong(input: SongInput): number {
  const next = db()
    .prepare("SELECT COALESCE(MAX(position), -1) + 1 AS pos FROM songs WHERE event_id = ? AND category = ?")
    .get(input.event_id, input.category) as { pos: number };

  const result = db()
    .prepare(
      `INSERT INTO songs (event_id, category, title, artist, cue, link, notes, position, source)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    .run(
      input.event_id,
      input.category,
      input.title,
      input.artist,
      input.cue,
      input.link,
      input.notes,
      next.pos,
      input.source,
    );
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

export const QUESTIONNAIRE_FIELDS: (keyof QuestionnaireInput)[] = [
  "preferred_genres", "avoid_genres", "vibe_notes", "announcements", "wedding_party",
  "mic_needs", "request_policy", "contact_on_day", "dedications", "last_name_taken",
  "arrival_time", "mc_name", "bridesmaids", "groomsmen", "venue_phone", "coordinator_email",
  "table_reserved", "space_reserved", "power_each_space", "outdoor_portions",
  "uplight_colours", "photobooth_hours", "playlist_pre_ceremony", "playlist_cocktail",
  "playlist_dinner", "playlist_dance",
];

export function saveQuestionnaire(eventId: number, input: QuestionnaireInput): void {
  const columns = ["event_id", ...QUESTIONNAIRE_FIELDS, "updated_at"];
  const updates = QUESTIONNAIRE_FIELDS.map((f) => `${f} = excluded.${f}`).join(", ");

  db()
    .prepare(
      `INSERT INTO questionnaires (${columns.join(", ")})
       VALUES (${columns.map(() => "?").join(", ")})
       ON CONFLICT(event_id) DO UPDATE SET ${updates}, updated_at = excluded.updated_at`,
    )
    .run(eventId, ...QUESTIONNAIRE_FIELDS.map((f) => input[f] ?? null), nowIso());
}

/* ------------------------------------------------------- entrance order */

export function entranceOrder(eventId: number): EntranceEntry[] {
  return db()
    .prepare("SELECT * FROM entrance_order WHERE event_id = ? ORDER BY position, id")
    .all(eventId) as EntranceEntry[];
}

export function replaceEntranceOrder(
  eventId: number,
  rows: { role: string; names: string | null }[],
): void {
  const write = db().transaction(() => {
    db().prepare("DELETE FROM entrance_order WHERE event_id = ?").run(eventId);
    const insert = db().prepare(
      "INSERT INTO entrance_order (event_id, position, role, names) VALUES (?, ?, ?, ?)",
    );
    rows.forEach((row, i) => {
      if (row.role.trim()) insert.run(eventId, i, row.role.trim(), row.names);
    });
  });
  write();
}

/* ------------------------------------------------------------- speeches */

export function speeches(eventId: number): SpeechEntry[] {
  return db()
    .prepare("SELECT * FROM speeches WHERE event_id = ? ORDER BY position, id")
    .all(eventId) as SpeechEntry[];
}

export type SpeechInput = {
  who: string;
  when_text: string | null;
  song_title: string | null;
  song_artist: string | null;
  song_cue: string | null;
};

export function replaceSpeeches(eventId: number, rows: SpeechInput[]): void {
  const write = db().transaction(() => {
    db().prepare("DELETE FROM speeches WHERE event_id = ?").run(eventId);
    const insert = db().prepare(
      `INSERT INTO speeches (event_id, position, who, when_text, song_title, song_artist, song_cue)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
    );
    rows.forEach((row, i) => {
      if (row.who.trim()) {
        insert.run(eventId, i, row.who.trim(), row.when_text, row.song_title, row.song_artist, row.song_cue);
      }
    });
  });
  write();
}

/* ------------------------------------------------------ recommendations */

/**
 * What past couples picked for a slot, most popular first. Compiled from the
 * planning forms and stored in aggregate — a couple filling in their planner
 * sees the picks, never whose wedding they came from.
 */
export function recommendationsFor(category: string, limit = 6): Recommendation[] {
  return db()
    .prepare(
      `SELECT * FROM recommendations WHERE category = ?
       ORDER BY times_picked DESC, title COLLATE NOCASE LIMIT ?`,
    )
    .all(category, limit) as Recommendation[];
}

export function allRecommendations(): Recommendation[] {
  return db()
    .prepare("SELECT * FROM recommendations ORDER BY category, times_picked DESC, title COLLATE NOCASE")
    .all() as Recommendation[];
}

/** Records a pick, bumping the count when the same song shows up again. */
export function recordRecommendation(
  category: string,
  title: string,
  artist: string | null,
  note: string | null = null,
): void {
  db()
    .prepare(
      `INSERT INTO recommendations (category, title, artist, times_picked, note)
       VALUES (?, ?, ?, 1, ?)
       ON CONFLICT(category, title, COALESCE(artist, '')) DO UPDATE SET
         times_picked = times_picked + 1,
         note = COALESCE(recommendations.note, excluded.note)`,
    )
    .run(category, title.trim(), artist?.trim() || null, note);
}

export function markPlanSubmitted(eventId: number): void {
  db().prepare("UPDATE events SET plan_submitted_at = ?, updated_at = ? WHERE id = ?").run(
    nowIso(),
    nowIso(),
    eventId,
  );
}

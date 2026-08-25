import "server-only";
import { getEvent } from "./events";
import { songsForEvent, timelineForEvent, getQuestionnaire } from "./planning";
import { notesForVenue } from "./venue-reports";
import { SONG_CATEGORIES, SONG_SECTIONS, type EventWithRefs, type Song } from "./types";
import type { User } from "./auth";

/**
 * The one page a DJ reads at the booth.
 *
 * Everything Piper knows about the night, in the order the night happens, laid
 * out like the planning spreadsheet the whole wedding side was built from —
 * Time, Section, Activity, Song, Artist, Cue. That is not nostalgia: it is the
 * order the office already thinks in, and a sheet that reads differently from
 * the sheet the plan was made on is a sheet somebody has to translate at
 * eleven at night with a dance floor waiting.
 *
 * Assembled here rather than in the page because the ordering is the hard part
 * and it deserves to be testable on its own.
 */

export type DayOfRow = {
  /** The clock time, where the timeline gives one. */
  time: string | null;
  section: string;
  activity: string;
  title: string | null;
  artist: string | null;
  cue: string | null;
  link: string | null;
  notes: string | null;
  /** A slot the couple left empty — worth seeing, not worth hiding. */
  empty: boolean;
  /** Timeline entries with no song slot of their own. */
  fromTimeline: boolean;
};

export type DayOfSheet = {
  event: EventWithRefs;
  rows: DayOfRow[];
  mustPlay: Song[];
  doNotPlay: Song[];
  /** Name and value, already filtered to what was answered. */
  facts: { label: string; value: string }[];
  playlists: { label: string; value: string }[];
  notes: { label: string; value: string }[];
  venueNotes: string[];
};

/** The facts a DJ wants before the doors open, in the order they matter. */
const FACT_FIELDS = [
  ["arrival_time", "Load-in from"],
  ["mc_name", "MC"],
  ["contact_on_day", "Call on the day"],
  ["venue_phone", "Venue phone"],
  ["coordinator_email", "Coordinator"],
  ["last_name_taken", "Name to announce"],
  ["bridesmaids", "Bridesmaids"],
  ["groomsmen", "Groomsmen"],
  ["table_reserved", "6ft table"],
  ["space_reserved", "10×10 space"],
  ["power_each_space", "Power"],
  ["outdoor_portions", "Outside"],
  ["uplight_colours", "Uplights"],
  ["photobooth_hours", "Photobooth"],
] as const;

/** The longer answers, which want room to breathe rather than a table cell. */
const NOTE_FIELDS = [
  ["mic_needs", "Microphones"],
  ["announcements", "Announcements and pronunciations"],
  ["wedding_party", "Wedding party"],
  ["request_policy", "Guest requests"],
  ["dedications", "Dedications"],
  ["preferred_genres", "They love"],
  ["avoid_genres", "Avoid"],
  ["vibe_notes", "The vibe"],
] as const;

const PLAYLIST_FIELDS = [
  ["playlist_pre_ceremony", "Pre-ceremony"],
  ["playlist_cocktail", "Cocktail"],
  ["playlist_dinner", "Dinner"],
  ["playlist_dance", "Dance"],
] as const;

/**
 * Matches a timeline entry to a song slot by name.
 *
 * Loose on purpose — "First Dance", "first dance", "The First Dance" are the
 * same moment, and a DJ who typed one of them into the timeline should not get
 * the song listed twice.
 */
function normalise(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, " ").trim();
}

export function buildDayOf(user: User, eventId: number): DayOfSheet | null {
  // Scoped like every other read: a DJ sees the weddings they are on, and one
  // they are not on is indistinguishable from one that does not exist.
  const event = getEvent(user, eventId);
  if (!event) return null;

  const songs = songsForEvent(eventId);
  const timeline = timelineForEvent(eventId);
  const questionnaire = getQuestionnaire(eventId);

  const byCategory = new Map<string, Song[]>();
  for (const song of songs) {
    const list = byCategory.get(song.category) ?? [];
    list.push(song);
    byCategory.set(song.category, list);
  }

  /*
   * The timeline is the spine.
   *
   * It is the only thing that knows the night runs load-in, ceremony, cocktails,
   * dinner, speeches, dancing — a fact no list of song slots contains. So each
   * timeline entry gets a rank from its position, every song slot inherits the
   * rank of the entry it names, and slots that name nothing settle just after
   * the last slot that did. Sorting on that gives one sequence.
   *
   * Times are not the sort key. Most couples fill the timeline in long before
   * anybody commits to clock times, and a sheet that collapses into "everything
   * with a time, then everything without" the moment one entry gets a time
   * would be worse than useless on exactly the weddings that need it most.
   */
  const rankOf = new Map<string, number>();
  const timeFor = new Map<string, string>();
  timeline.forEach((item, position) => {
    const key = normalise(item.title);
    if (!rankOf.has(key)) rankOf.set(key, position);
    if (item.start_time) timeFor.set(key, item.start_time);
  });
  const claimed = new Set<string>();

  type Ranked = DayOfRow & { rank: number };
  const ranked: Ranked[] = [];

  // The music slots, in the order of the night. "Anytime" is deliberately left
  // out — must-play and do-not-play are lists to keep in view all evening, not
  // moments to run in sequence.
  const running = SONG_CATEGORIES.filter((c) => c.section !== "Anytime");

  /*
   * Each slot's rank, resolved in two passes.
   *
   * Forwards fills a slot with no timeline entry of its own from the last one
   * that had. Backwards catches the slots before the first match — the whole
   * ceremony, on a timeline whose first recognised entry is the cocktail hour.
   * With only the forward pass those slots anchored to nothing and sorted
   * ahead of load-in, which put the processional before the van arrived.
   */
  const rankFor = new Map<string, number>();
  const matchedRank = running.map((c) => rankOf.get(normalise(c.label)));

  let last: number | null = null;
  let drift = 0;
  running.forEach((category, i) => {
    const matched = matchedRank[i];
    if (matched !== undefined) {
      last = matched;
      drift = 0;
      rankFor.set(category.key, matched);
      claimed.add(normalise(category.label));
    } else if (last !== null) {
      drift += 1;
      rankFor.set(category.key, last + drift / 1000);
    }
  });

  // Anything still unplaced comes before the first match, in its own order.
  const firstMatch = matchedRank.find((r) => r !== undefined);
  if (firstMatch !== undefined) {
    const unplaced = running.filter((c) => !rankFor.has(c.key));
    unplaced.forEach((category, i) => {
      rankFor.set(category.key, firstMatch - (unplaced.length - i) / 1000);
    });
  } else {
    // No timeline entry matched anything, so the categories are the only order
    // there is. Keep them in their own sequence, after the timeline.
    running.forEach((category, i) => rankFor.set(category.key, timeline.length + i / 1000));
  }

  for (const category of running) {
    const key = normalise(category.label);
    const rank = rankFor.get(category.key) ?? 0;
    const time = timeFor.get(key) ?? null;

    const list = byCategory.get(category.key) ?? [];
    if (list.length === 0) {
      // An optional slot nobody filled in is a decision, not a gap.
      if (category.optional) continue;
      ranked.push({
        rank,
        time,
        section: category.section,
        activity: category.label,
        title: null,
        artist: null,
        cue: null,
        link: null,
        notes: null,
        empty: true,
        fromTimeline: false,
      });
      continue;
    }

    for (const song of list) {
      ranked.push({
        rank,
        time,
        section: category.section,
        activity: category.label,
        title: song.title,
        artist: song.artist,
        cue: song.cue,
        link: song.link,
        notes: song.notes,
        empty: false,
        fromTimeline: false,
      });
    }
  }

  // Everything on the timeline that is not a music slot — the buffet, the
  // speeches, the shuttle — so the sheet is the whole night rather than the
  // musical parts of it.
  timeline.forEach((item, position) => {
    if (claimed.has(normalise(item.title))) return;
    ranked.push({
      rank: position,
      time: item.start_time,
      section: "Running order",
      activity: item.title,
      title: null,
      artist: null,
      cue: null,
      link: null,
      notes: item.notes,
      empty: false,
      fromTimeline: true,
    });
  });

  // Ties go to the moment before the music for it: "Grand entrance" reads
  // better above its song than below it.
  ranked.sort((a, b) => a.rank - b.rank || Number(b.fromTimeline) - Number(a.fromTimeline));
  const rows: DayOfRow[] = ranked.map(({ rank: _rank, ...row }) => row);

  const answered = <K extends string>(fields: readonly (readonly [K, string])[]) =>
    fields
      .map(([key, label]) => ({
        label,
        value: (questionnaire?.[key as keyof typeof questionnaire] as string | null) ?? "",
      }))
      .filter((f) => f.value.trim().length > 0);

  return {
    event,
    rows,
    mustPlay: byCategory.get("must_play") ?? [],
    doNotPlay: byCategory.get("do_not_play") ?? [],
    facts: answered(FACT_FIELDS),
    notes: answered(NOTE_FIELDS),
    playlists: answered(PLAYLIST_FIELDS),
    venueNotes: event.venue_id
      ? notesForVenue(event.venue_id, 6).map((n) => n.notes)
      : [],
  };
}

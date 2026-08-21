export type EventStatus = "tentative" | "confirmed" | "completed" | "cancelled";

export const EVENT_STATUSES: EventStatus[] = ["tentative", "confirmed", "completed", "cancelled"];

export const STATUS_LABELS: Record<EventStatus, string> = {
  tentative: "Tentative",
  confirmed: "Confirmed",
  completed: "Completed",
  cancelled: "Cancelled",
};

export type EventRow = {
  id: number;
  status: EventStatus;
  partner_one_name: string;
  partner_two_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  event_date: string;
  load_in_time: string | null;
  ceremony_time: string | null;
  cocktail_time: string | null;
  reception_time: string | null;
  end_time: string | null;
  venue_id: number | null;
  venue_room: string | null;
  guest_count: number | null;
  package_name: string | null;
  assigned_dj_id: number | null;
  internal_notes: string | null;
  plan_token: string;
  plan_submitted_at: string | null;
  created_at: string;
  updated_at: string;
};

/** An event joined with the names it is almost always displayed with. */
export type EventWithRefs = EventRow & {
  venue_name: string | null;
  venue_city: string | null;
  dj_name: string | null;
};

export type Venue = {
  id: number;
  name: string;
  address: string | null;
  city: string | null;
  contact_name: string | null;
  contact_email: string | null;
  contact_phone: string | null;
  load_in_notes: string | null;
  created_at: string;
};

export type Song = {
  id: number;
  event_id: number;
  category: string;
  title: string;
  artist: string | null;
  /** "start at 1:28", "fade out ~1:50", "first 48 seconds only". */
  cue: string | null;
  /** Spotify / Apple / YouTube link to the exact version wanted. */
  link: string | null;
  notes: string | null;
  position: number;
  source: "team" | "client";
  created_at: string;
};

export type TimelineItem = {
  id: number;
  event_id: number;
  start_time: string | null;
  title: string;
  notes: string | null;
  position: number;
  created_at: string;
};

export type Questionnaire = {
  event_id: number;
  preferred_genres: string | null;
  avoid_genres: string | null;
  vibe_notes: string | null;
  announcements: string | null;
  wedding_party: string | null;
  mic_needs: string | null;
  /** Free text: real answers are nuanced, not yes/no. */
  request_policy: string | null;
  contact_on_day: string | null;
  dedications: string | null;
  last_name_taken: string | null;
  arrival_time: string | null;
  mc_name: string | null;
  bridesmaids: string | null;
  groomsmen: string | null;
  /* Load-in facts the DJ needs before the day. */
  venue_phone: string | null;
  coordinator_email: string | null;
  table_reserved: string | null;
  space_reserved: string | null;
  power_each_space: string | null;
  outdoor_portions: string | null;
  uplight_colours: string | null;
  photobooth_hours: string | null;
  /* Couples often hand over a whole playlist rather than song-by-song. */
  playlist_pre_ceremony: string | null;
  playlist_cocktail: string | null;
  playlist_dinner: string | null;
  playlist_dance: string | null;
  updated_at: string;
};

/** One line of the grand-entrance order: position, and who walks in it. */
export type EntranceEntry = {
  id: number;
  event_id: number;
  position: number;
  role: string;
  names: string | null;
};

/** A speech or toast, with the walk-up song the speaker enters to. */
export type SpeechEntry = {
  id: number;
  event_id: number;
  position: number;
  who: string;
  when_text: string | null;
  song_title: string | null;
  song_artist: string | null;
  song_cue: string | null;
};

/** What past couples picked for a slot. Aggregate only — no couple named. */
export type Recommendation = {
  id: number;
  category: string;
  title: string;
  artist: string | null;
  times_picked: number;
  note: string | null;
};

/**
 * Song slots, mirroring the Pynx planning form's timeline exactly — same
 * sections, same activity names, same order. Couples already know this shape
 * from the spreadsheet, and DJs already work from it.
 *
 * `single` slots hold one song. `list` slots hold many, or a playlist link.
 */
export type SongSection = "Ceremony" | "Cocktail Time" | "Reception" | "Anytime";

export type SongCategory = {
  key: string;
  label: string;
  hint: string;
  section: SongSection;
  /** Shown on the client-facing planner. */
  client: boolean;
  /** Single-song slots render as one line rather than a list. */
  single: boolean;
  /** Optional slots are only offered if the couple is doing them. */
  optional?: boolean;
};

export const SONG_CATEGORIES: SongCategory[] = [
  { key: "guest_arrival", label: "Guest arrival & seating", hint: "Playing as guests arrive and take their seats", section: "Ceremony", client: true, single: false },
  { key: "bridal_party_processional", label: "Bridal party processional", hint: "The wedding party walking in", section: "Ceremony", client: true, single: true },
  { key: "bride_processional", label: "Bride's processional", hint: "The walk down the aisle", section: "Ceremony", client: true, single: true },
  { key: "groom_processional", label: "Groom's processional", hint: "Only if the groom walks in separately", section: "Ceremony", client: true, single: true, optional: true },
  { key: "flower_girls", label: "Flower girls / ring bearers", hint: "Optional", section: "Ceremony", client: true, single: true, optional: true },
  { key: "signing_registry", label: "Signing of the registry", hint: "Played while the paperwork is signed", section: "Ceremony", client: true, single: true },
  { key: "recessional", label: "Recessional", hint: "Walking back up the aisle — usually something upbeat", section: "Ceremony", client: true, single: true },

  { key: "cocktail", label: "Cocktail hour", hint: "Background while guests mingle. A playlist link is fine", section: "Cocktail Time", client: true, single: false },

  { key: "grand_entrance_party", label: "Grand entrance — wedding party", hint: "The party coming into the reception", section: "Reception", client: true, single: true },
  { key: "grand_entrance_couple", label: "Grand entrance — the couple", hint: "Your entrance", section: "Reception", client: true, single: true },
  { key: "first_dance", label: "First dance", hint: "Your song", section: "Reception", client: true, single: true },
  { key: "dinner", label: "Dinner", hint: "Lower energy, conversation-friendly. A playlist link is fine", section: "Reception", client: true, single: false },
  { key: "father_daughter", label: "Father / daughter dance", hint: "Optional", section: "Reception", client: true, single: true, optional: true },
  { key: "mother_son", label: "Mother / son dance", hint: "Optional", section: "Reception", client: true, single: true, optional: true },
  { key: "combined_parent_dance", label: "Combined parent dance", hint: "If you'd rather do one dance together", section: "Reception", client: true, single: true, optional: true },
  { key: "cake_cutting", label: "Cake cutting", hint: "Short and sweet", section: "Reception", client: true, single: true, optional: true },
  { key: "bouquet_garter", label: "Bouquet / garter", hint: "Optional", section: "Reception", client: true, single: true, optional: true },
  { key: "open_dancing", label: "Opening the dance floor", hint: "The song that gets everyone up", section: "Reception", client: true, single: true },
  { key: "last_dance", label: "Last dance", hint: "How the night closes", section: "Reception", client: true, single: true },

  { key: "must_play", label: "Must play", hint: "Songs the night cannot end without", section: "Anytime", client: true, single: false },
  { key: "do_not_play", label: "Do NOT play", hint: "Hard no, whatever anyone requests", section: "Anytime", client: true, single: false },
];

export const SONG_SECTIONS: SongSection[] = ["Ceremony", "Cocktail Time", "Reception", "Anytime"];

export function categoryFor(key: string): SongCategory | undefined {
  return SONG_CATEGORIES.find((c) => c.key === key);
}

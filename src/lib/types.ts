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
  takes_requests: number;
  contact_on_day: string | null;
  updated_at: string;
};

/**
 * Song categories, in the order a wedding actually runs.
 * `key` is what lands in songs.category; `limit` is a soft guide shown to the couple.
 */
export type SongCategory = {
  key: string;
  label: string;
  hint: string;
  /** Shown on the client-facing planner. Internal-only categories are hidden there. */
  client: boolean;
  /** Single-song slots render as one line rather than a list. */
  single: boolean;
};

export const SONG_CATEGORIES: SongCategory[] = [
  { key: "ceremony_prelude", label: "Ceremony prelude", hint: "Playing as guests are seated", client: true, single: false },
  { key: "ceremony_processional", label: "Processional", hint: "Walking down the aisle", client: true, single: true },
  { key: "ceremony_recessional", label: "Recessional", hint: "Walking back up the aisle", client: true, single: true },
  { key: "cocktail", label: "Cocktail hour", hint: "Background vibe while guests mingle", client: true, single: false },
  { key: "dinner", label: "Dinner", hint: "Lower energy, conversation-friendly", client: true, single: false },
  { key: "grand_entrance", label: "Grand entrance", hint: "Introducing the newlyweds", client: true, single: true },
  { key: "first_dance", label: "First dance", hint: "Your song", client: true, single: true },
  { key: "parent_dance_one", label: "Parent dance 1", hint: "e.g. father–daughter", client: true, single: true },
  { key: "parent_dance_two", label: "Parent dance 2", hint: "e.g. mother–son", client: true, single: true },
  { key: "cake_cutting", label: "Cake cutting", hint: "Short and sweet", client: true, single: true },
  { key: "bouquet_toss", label: "Bouquet / garter", hint: "Optional", client: true, single: true },
  { key: "must_play", label: "Must play", hint: "Songs the floor cannot end without", client: true, single: false },
  { key: "do_not_play", label: "Do NOT play", hint: "Hard no, whatever the request", client: true, single: false },
  { key: "last_dance", label: "Last dance", hint: "How the night closes", client: true, single: true },
];

export function categoryFor(key: string): SongCategory | undefined {
  return SONG_CATEGORIES.find((c) => c.key === key);
}

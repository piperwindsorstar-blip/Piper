/**
 * Each couple's copy of the Default Planning form.
 * The shared Google sheet stays the blank original.
 */

export const PLANNING_CHOICES = ['Yes', 'No', 'Not yet'] as const

export const TIMELINE: ReadonlyArray<{ section: string; activity: string }> = [
  { section: 'Ceremony', activity: 'Guest arrival and seating' },
  { section: 'Ceremony', activity: 'Bridal party processional' },
  { section: 'Ceremony', activity: "Bride's processional" },
  { section: 'Ceremony', activity: 'Signing of the registry' },
  { section: 'Ceremony', activity: 'Recessional' },
  { section: 'Cocktail time', activity: 'Cocktail hour' },
  { section: 'Reception', activity: 'Grand entrance, wedding party' },
  { section: 'Reception', activity: 'Grand entrance, couple' },
  { section: 'Reception', activity: 'First dance' },
  { section: 'Reception', activity: 'Dinner music' },
  { section: 'Reception', activity: 'Mother and son dance' },
  { section: 'Reception', activity: 'Father and daughter dance' },
  { section: 'Reception', activity: 'Other' },
  { section: 'Reception', activity: 'Open dance floor' },
  { section: 'Reception', activity: 'Cake cutting' },
  { section: 'Reception', activity: 'Bouquet toss' },
  { section: 'Reception', activity: 'Last dance' },
  { section: 'Reception', activity: 'Other, later in the night' },
]

export type TimelineRow = {
  time: string
  section: string
  activity: string
  song: string
  artist: string
  notes: string
}

export type AppearanceRow = {
  names: string
  people: string
  when: string
  notes: string
}

export type Planning = {
  coupleNames: string
  email: string
  phone: string
  weddingDate: string
  venueName: string
  arrivalTime: string
  ceremonyAddress: string
  receptionAddress: string
  venuePhone: string
  plannerEmail: string
  lastName: string
  bridesmaids: string
  groomsmen: string
  tableForDj: string
  spaceForDj: string
  outside: string
  power: string
  mc: string
  requests: string
  guestCount: string
  uplightColours: string
  photobooth: string
  genres: string
  dedications: string
  mood: string
  guestRequests: string
  mustPlay: string
  doNotPlay: string
  preCeremony: string
  cocktail: string
  dinner: string
  dance: string
  specialPlaylists: string
  appearances: AppearanceRow[]
  timeline: TimelineRow[]
}

const SHORT = 200
const LONG = 2000
const APPEARANCE_ROWS = 4
const APPEARANCE_MAX = 24

export type PlanningSeed = {
  coupleNames: string
  email: string
  phone: string
  weddingDate: string
  venueName: string
}

export function blankPlanning(seed: PlanningSeed): Planning {
  return {
    coupleNames: clip(seed.coupleNames, SHORT),
    email: clip(seed.email, SHORT),
    phone: clip(seed.phone, 40),
    weddingDate: clip(seed.weddingDate, SHORT),
    venueName: clip(seed.venueName, SHORT),
    arrivalTime: '',
    ceremonyAddress: '',
    receptionAddress: '',
    venuePhone: '',
    plannerEmail: '',
    lastName: '',
    bridesmaids: '',
    groomsmen: '',
    tableForDj: '',
    spaceForDj: '',
    outside: '',
    power: '',
    mc: '',
    requests: '',
    guestCount: '',
    uplightColours: '',
    photobooth: '',
    genres: '',
    dedications: '',
    mood: '',
    guestRequests: '',
    mustPlay: '',
    doNotPlay: '',
    preCeremony: '',
    cocktail: '',
    dinner: '',
    dance: '',
    specialPlaylists: '',
    appearances: Array.from({ length: APPEARANCE_ROWS }, blankAppearance),
    timeline: TIMELINE.map((row) => ({
      time: '',
      section: row.section,
      activity: row.activity,
      song: '',
      artist: '',
      notes: '',
    })),
  }
}

function blankAppearance(): AppearanceRow {
  return { names: '', people: '', when: '', notes: '' }
}

function field(
  raw: Record<string, unknown>,
  key: string,
  max: number,
  fallback: string,
): string {
  if (!(key in raw)) return clip(fallback, max)
  return clip(raw[key], max)
}

function clip(value: unknown, max: number): string {
  if (typeof value !== 'string') return ''
  return value.trim().slice(0, max)
}

function choice(value: unknown): string {
  const next = clip(value, 20)
  return PLANNING_CHOICES.includes(next as (typeof PLANNING_CHOICES)[number])
    ? next
    : ''
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {}
  return value as Record<string, unknown>
}

export function planningFromUnknown(
  value: unknown,
  seed: PlanningSeed,
): Planning {
  const raw = asRecord(value)
  const appearances = Array.isArray(raw.appearances) ? raw.appearances : []
  const timeline = Array.isArray(raw.timeline) ? raw.timeline : []
  const base = blankPlanning(seed)
  return {
    ...base,
    coupleNames: field(raw, 'coupleNames', SHORT, seed.coupleNames),
    email: field(raw, 'email', SHORT, seed.email),
    phone: field(raw, 'phone', 40, seed.phone),
    weddingDate: field(raw, 'weddingDate', SHORT, seed.weddingDate),
    venueName: field(raw, 'venueName', SHORT, seed.venueName),
    arrivalTime: clip(raw.arrivalTime, SHORT),
    ceremonyAddress: clip(raw.ceremonyAddress, LONG),
    receptionAddress: clip(raw.receptionAddress, LONG),
    venuePhone: clip(raw.venuePhone, 40),
    plannerEmail: clip(raw.plannerEmail, SHORT),
    lastName: clip(raw.lastName, SHORT),
    bridesmaids: clip(raw.bridesmaids, SHORT),
    groomsmen: clip(raw.groomsmen, SHORT),
    tableForDj: choice(raw.tableForDj),
    spaceForDj: choice(raw.spaceForDj),
    outside: choice(raw.outside),
    power: choice(raw.power),
    mc: clip(raw.mc, SHORT),
    requests: clip(raw.requests, LONG),
    guestCount: clip(raw.guestCount, 40),
    uplightColours: clip(raw.uplightColours, SHORT),
    photobooth: clip(raw.photobooth, SHORT),
    genres: clip(raw.genres, LONG),
    dedications: clip(raw.dedications, LONG),
    mood: clip(raw.mood, LONG),
    guestRequests: clip(raw.guestRequests, LONG),
    mustPlay: clip(raw.mustPlay, LONG),
    doNotPlay: clip(raw.doNotPlay, LONG),
    preCeremony: clip(raw.preCeremony, LONG),
    cocktail: clip(raw.cocktail, LONG),
    dinner: clip(raw.dinner, LONG),
    dance: clip(raw.dance, LONG),
    specialPlaylists: clip(raw.specialPlaylists, LONG),
    appearances: appearances.slice(0, APPEARANCE_MAX).map((row) => {
      const item = asRecord(row)
      return {
        names: clip(item.names, SHORT),
        people: clip(item.people, SHORT),
        when: clip(item.when, SHORT),
        notes: clip(item.notes, LONG),
      }
    }),
    timeline: base.timeline.map((row, index) => {
      const item = asRecord(timeline[index])
      return {
        ...row,
        time: clip(item.time, 40),
        song: clip(item.song, SHORT),
        artist: clip(item.artist, SHORT),
        notes: clip(item.notes, LONG),
      }
    }),
  }
}

export function parsePlanning(
  stored: string | null | undefined,
  seed: PlanningSeed,
): { planning: Planning; saved: boolean } {
  if (!stored?.trim()) return { planning: blankPlanning(seed), saved: false }
  try {
    return {
      planning: planningFromUnknown(JSON.parse(stored) as unknown, seed),
      saved: true,
    }
  } catch {
    return { planning: blankPlanning(seed), saved: false }
  }
}

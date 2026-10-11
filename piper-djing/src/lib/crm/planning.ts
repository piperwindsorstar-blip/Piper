/**
 * Each couple's copy of the Default Planning form.
 * The shared Google sheet stays the blank original.
 */

export const PLANNING_CHOICES = ['Yes', 'No', 'Not yet'] as const

export const TIMELINE: ReadonlyArray<{ section: string; activity: string }> = [
  { section: 'Ceremony', activity: 'Guest arrival & seating' },
  { section: 'Ceremony', activity: 'Bridal party processional' },
  { section: 'Ceremony', activity: "Bride's processional" },
  { section: 'Ceremony', activity: 'Signing of the registry' },
  { section: 'Ceremony', activity: 'Recessional' },
  { section: 'Cocktail time', activity: 'Cocktail hour' },
  { section: 'Reception', activity: 'Grand entrance (whole wedding party)' },
  { section: 'Reception', activity: 'Grand entrance (bride and groom)' },
  { section: 'Reception', activity: 'First dance' },
  { section: 'Reception', activity: 'Dinner music' },
  { section: 'Reception', activity: 'Mother/son dance' },
  { section: 'Reception', activity: 'Father/daughter dance' },
  { section: 'Reception', activity: 'Other (put in notes)' },
  { section: 'Reception', activity: 'Open dance floor' },
  { section: 'Reception', activity: 'Cake cutting' },
  { section: 'Reception', activity: 'Bouquet toss' },
  { section: 'Reception', activity: 'Last dance' },
  { section: 'Reception', activity: 'Other (put in notes)' },
]

export type TimelineRow = {
  time: string
  section: string
  activity: string
  song: string
  artist: string
  notes: string
  link: string
  hidden: boolean
  label: string
}

export type AppearanceRole = '' | 'entrance' | 'speech' | 'dance' | 'other'

export type AppearanceRow = {
  names: string
  people: string
  when: string
  notes: string
  role: AppearanceRole
}

export type SongItem = {
  song: string
  artist: string
  link: string
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
  mcContact: string
  genreChips: string[]
  mustPlayItems: SongItem[]
  doNotPlayItems: SongItem[]
  receptionSame: boolean
  planLocked: boolean
  dueDate: string
  djName: string
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
      link: '',
      hidden: false,
      label: '',
    })),
    mcContact: '',
    genreChips: [],
    mustPlayItems: [],
    doNotPlayItems: [],
    receptionSame: false,
    planLocked: false,
    dueDate: '',
    djName: '',
  }
}

function blankAppearance(): AppearanceRow {
  return { names: '', people: '', when: '', notes: '', role: '' }
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

const CHOICE_VALUES = new Set<string>([
  ...PLANNING_CHOICES,
  'Not sure',
  'Play what fits',
  'Our lists only',
  'No requests',
])

function choice(value: unknown): string {
  const next = clip(value, 40)
  return CHOICE_VALUES.has(next) ? next : ''
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
        role: appearanceRole(item.role),
      }
    }),
    timeline: [
      ...base.timeline.map((row, index) => {
        const item = asRecord(timeline[index])
        const songBits = timelineSong(item)
        return {
          ...row,
          time: clip(item.time, 40),
          song: clip(item.song, SHORT),
          artist: clip(item.artist, SHORT),
          notes: songBits.notes,
          link: songBits.link,
          hidden: item.hidden === true,
          label: clip(item.label, SHORT),
        }
      }),
      ...timeline
        .slice(base.timeline.length, base.timeline.length + 12)
        .map((row) => {
          const item = asRecord(row)
          const songBits = timelineSong(item)
          return {
            time: clip(item.time, 40),
            section: clip(item.section, SHORT) || 'Reception',
            activity: clip(item.activity, SHORT) || 'Added moment',
            song: clip(item.song, SHORT),
            artist: clip(item.artist, SHORT),
            notes: songBits.notes,
            link: songBits.link,
            hidden: item.hidden === true,
            label: clip(item.label, SHORT),
          }
        }),
    ],
    mcContact: clip(raw.mcContact, SHORT),
    genreChips: stringList(raw.genreChips, 24),
    mustPlayItems: songList(raw.mustPlayItems),
    doNotPlayItems: songList(raw.doNotPlayItems),
    receptionSame: raw.receptionSame === true,
    planLocked: raw.planLocked === true,
    dueDate: isoDate(raw.dueDate),
    djName: clip(raw.djName, SHORT),
  }
}

const ROLES = new Set<AppearanceRole>([
  '',
  'entrance',
  'speech',
  'dance',
  'other',
])

function appearanceRole(value: unknown): AppearanceRole {
  const next = clip(value, 20)
  return ROLES.has(next as AppearanceRole) ? (next as AppearanceRole) : ''
}

function stringList(value: unknown, max: number): string[] {
  if (!Array.isArray(value)) return []
  return value
    .slice(0, max)
    .map((item) => clip(item, SHORT))
    .filter((item) => item !== '')
}

function songList(value: unknown): SongItem[] {
  if (!Array.isArray(value)) return []
  return value.slice(0, 40).map((row) => {
    const item = asRecord(row)
    return {
      song: clip(item.song, SHORT),
      artist: clip(item.artist, SHORT),
      link: clip(item.link, LONG),
    }
  })
}

function timelineSong(item: Record<string, unknown>): {
  notes: string
  link: string
} {
  const notes = clip(item.notes, LONG)
  const link = clip(item.link, LONG)
  if (link) return { notes, link }
  if (isSongLink(notes)) return { notes: '', link: notes }
  return { notes, link: '' }
}

function isSongLink(value: string): boolean {
  return (
    /^https?:\/\//i.test(value) ||
    /spotify\.com|youtu\.?be|youtube\.com|music\.apple\.com|soundcloud\.com/i.test(
      value,
    )
  )
}

function isoDate(value: unknown): string {
  const next = clip(value, 10)
  return /^\d{4}-\d{2}-\d{2}$/.test(next) ? next : ''
}

/** The couple cannot change the DJ's fields or unlock a sent plan. */
export function mergeCoupleSave(
  existing: Planning,
  incoming: Planning,
): Planning {
  return {
    ...incoming,
    planLocked: existing.planLocked,
    dueDate: existing.dueDate,
    djName: existing.djName,
    arrivalTime: existing.arrivalTime,
  }
}

export function isPlanLocked(planning: Planning, today: string): boolean {
  if (planning.planLocked) return true
  return Boolean(planning.dueDate) && today > planning.dueDate
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

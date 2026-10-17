/**
 * Each couple's copy of the Default Planning form.
 * The shared Google sheet stays the blank original.
 */

export const PLANNING_CHOICES = ['Yes', 'No', 'Not yet'] as const

export const MOMENTS: ReadonlyArray<{
  key: string
  section: string
  activity: string
  sortable: boolean
}> = [
  {
    key: 'guest-arrival',
    section: 'Ceremony',
    activity: 'Guest arrival & seating',
    sortable: true,
  },
  {
    key: 'bridal-party',
    section: 'Ceremony',
    activity: 'Wedding party processional',
    sortable: true,
  },
  {
    key: 'bride-processional',
    section: 'Ceremony',
    activity: "Couple's processional",
    sortable: true,
  },
  {
    key: 'registry',
    section: 'Ceremony',
    activity: 'Signing of the registry',
    sortable: true,
  },
  {
    key: 'recessional',
    section: 'Ceremony',
    activity: 'Recessional',
    sortable: true,
  },
  {
    key: 'cocktail-hour',
    section: 'Cocktail time',
    activity: 'Cocktail hour',
    sortable: false,
  },
  {
    key: 'entrance-party',
    section: 'Reception',
    activity: 'Grand entrance: wedding party',
    sortable: true,
  },
  {
    key: 'entrance-couple',
    section: 'Reception',
    activity: 'Grand entrance: the couple',
    sortable: true,
  },
  {
    key: 'first-dance',
    section: 'Reception',
    activity: 'First dance',
    sortable: true,
  },
  {
    key: 'speeches',
    section: 'Reception',
    activity: 'Speeches',
    sortable: true,
  },
  {
    key: 'mother-son',
    section: 'Reception',
    activity: 'Parent dance',
    sortable: true,
  },
  {
    key: 'father-daughter',
    section: 'Reception',
    activity: 'Second parent dance',
    sortable: true,
  },
  {
    key: 'bouquet',
    section: 'Reception',
    activity: 'Bouquet toss',
    sortable: true,
  },
  {
    key: 'open-dance',
    section: 'Reception',
    activity: 'Open dance floor',
    sortable: true,
  },
  {
    key: 'last-dance',
    section: 'Reception',
    activity: 'Last dance',
    sortable: true,
  },
]

export const TIMELINE: ReadonlyArray<{ section: string; activity: string }> =
  MOMENTS.map((moment) => ({
    section: moment.section,
    activity: moment.activity,
  }))

export type TimelineRow = {
  id: string
  presetKey: string
  time: string
  section: string
  activity: string
  song: string
  artist: string
  notes: string
  link: string
  hidden: boolean
  label: string
  people: string
  /** Who is in this moment, each with a song (or a time, for speeches). */
  entries: MomentEntry[]
  /** How the grand entrance of the wedding party is split up. */
  mode: EntranceMode | ''
  /** The couple go straight from their entrance into the first dance. */
  direct: boolean
}

export type MomentEntry = {
  id: string
  name: string
  time: string
  song: string
  artist: string
  link: string
}

export type EntranceMode = 'pairs' | 'split' | 'whole'

export type MomentKind =
  | 'song'
  | 'time'
  | 'time-notes'
  | 'speakers'
  | 'party'
  | 'entrance-party'
  | 'entrance-couple'

export function momentKind(presetKey: string): MomentKind {
  if (presetKey === 'guest-arrival') return 'time'
  if (presetKey === 'cocktail-hour') return 'time-notes'
  if (presetKey === 'speeches') return 'speakers'
  if (presetKey === 'bridal-party') return 'party'
  if (presetKey === 'entrance-party') return 'entrance-party'
  if (presetKey === 'entrance-couple') return 'entrance-couple'
  return 'song'
}

export const PARTY_OPTIONS: ReadonlyArray<{ id: string; name: string }> = [
  { id: 'partner', name: 'Partner' },
  { id: 'attendants', name: 'Attendants' },
  { id: 'groom', name: 'Groom' },
  { id: 'groomsmen', name: 'Groomsmen' },
  { id: 'bridesmaids', name: 'Bridesmaids' },
]

const ENTRY_MAX = 24
const PAIR_MAX = 12

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
  timeline: TimelineRow[]
  mcContact: string
  mcToldFindDj: string
  fromInquiry: string[]
  genreChips: string[]
  mustPlayItems: SongItem[]
  doNotPlayItems: SongItem[]
  receptionSame: boolean
  planLocked: boolean
  dueDate: string
  djName: string
  /** Questions the couple chose to skip for now, so Continue moves past them. */
  skipped: string[]
}

const SHORT = 200
const LONG = 2000

export const INQUIRY_FIELDS = [
  'email',
  'phone',
  'venueName',
  'ceremonyAddress',
  'receptionAddress',
] as const

export type PlanningSeed = {
  coupleNames: string
  email: string
  phone: string
  weddingDate: string
  venueName: string
  ceremonyAddress?: string
  receptionAddress?: string
}

export function blankPlanning(seed: PlanningSeed): Planning {
  return {
    coupleNames: clip(seed.coupleNames, SHORT),
    email: clip(seed.email, SHORT),
    phone: clip(seed.phone, 40),
    weddingDate: clip(seed.weddingDate, SHORT),
    venueName: clip(seed.venueName, SHORT),
    arrivalTime: '',
    ceremonyAddress: clip(seed.ceremonyAddress, LONG),
    receptionAddress: clip(seed.receptionAddress, LONG),
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
    timeline: MOMENTS.map(blankMoment),
    mcContact: '',
    mcToldFindDj: '',
    fromInquiry: [...INQUIRY_FIELDS],
    genreChips: [],
    mustPlayItems: [],
    doNotPlayItems: [],
    receptionSame: false,
    planLocked: false,
    dueDate: '',
    djName: '',
    skipped: [],
  }
}

function blankMoment(moment: (typeof MOMENTS)[number]): TimelineRow {
  return {
    id: moment.key,
    presetKey: moment.key,
    time: '',
    section: moment.section,
    activity: moment.activity,
    song: '',
    artist: '',
    notes: '',
    link: '',
    hidden: false,
    label: '',
    people: '',
    entries: [],
    mode: '',
    direct: false,
  }
}

function inquiryValue(seed: PlanningSeed, id: string): string {
  if (id === 'email') return seed.email
  if (id === 'phone') return seed.phone
  if (id === 'venueName') return seed.venueName
  if (id === 'ceremonyAddress') return seed.ceremonyAddress ?? ''
  if (id === 'receptionAddress') return seed.receptionAddress ?? ''
  return ''
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
    ceremonyAddress: field(raw, 'ceremonyAddress', LONG, ''),
    receptionAddress: field(raw, 'receptionAddress', LONG, ''),
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
    timeline: normalizeTimeline(timeline.map((row) => asRecord(row))),
    mcContact: clip(raw.mcContact, SHORT),
    mcToldFindDj: mcTold(raw.mcToldFindDj),
    fromInquiry: inquiryList(raw.fromInquiry),
    genreChips: stringList(raw.genreChips, 24),
    mustPlayItems: songList(raw.mustPlayItems),
    doNotPlayItems: songList(raw.doNotPlayItems),
    receptionSame: raw.receptionSame === true,
    planLocked: raw.planLocked === true,
    dueDate: isoDate(raw.dueDate),
    djName: clip(raw.djName, SHORT),
    skipped: stringList(raw.skipped, 80).filter((id) =>
      /^[\w-]{1,80}$/.test(id),
    ),
  }
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

const LEGACY_MOMENT: Record<string, string> = {
  'guest arrival & seating': 'guest-arrival',
  'bridal party processional': 'bridal-party',
  "bride's processional": 'bride-processional',
  'signing of the registry': 'registry',
  recessional: 'recessional',
  'cocktail hour': 'cocktail-hour',
  'grand entrance (whole wedding party)': 'entrance-party',
  'grand entrance: whole wedding party': 'entrance-party',
  'grand entrance: wedding party': 'entrance-party',
  'grand entrance (bride and groom)': 'entrance-couple',
  'grand entrance: the couple': 'entrance-couple',
  'first dance': 'first-dance',
  speeches: 'speeches',
  'mother/son dance': 'mother-son',
  'father/daughter dance': 'father-daughter',
  'bouquet toss': 'bouquet',
  'open dance floor': 'open-dance',
  'last dance': 'last-dance',
  // The neutral names (Oct 2026). Couples can still rename any moment.
  'wedding party processional': 'bridal-party',
  "couple's processional": 'bride-processional',
  'parent dance': 'mother-son',
  'second parent dance': 'father-daughter',
}

function momentContent(row: Record<string, unknown>): boolean {
  return Boolean(
    clip(row.time, 40) ||
    clip(row.song, SHORT) ||
    clip(row.artist, SHORT) ||
    clip(row.notes, LONG) ||
    clip(row.link, LONG) ||
    clip(row.label, SHORT) ||
    clip(row.people, SHORT) ||
    (Array.isArray(row.entries) && row.entries.length > 0),
  )
}

type MomentFields = Omit<
  TimelineRow,
  'id' | 'presetKey' | 'section' | 'activity'
>

/**
 * Plans saved before the bridal party and the wedding party entrance held
 * several songs kept one song on the row. It becomes the first entry, so
 * nothing the couple already picked is lost.
 */
function carryLegacySong(fields: MomentFields, key: string): MomentFields {
  const kind = momentKind(key)
  const hasSong = entryHasSong(fields)
  if (kind === 'party' && fields.entries.length === 0 && hasSong) {
    return {
      ...fields,
      song: '',
      artist: '',
      link: '',
      entries: [
        {
          id: 'custom-1',
          name: 'Bridal party',
          time: '',
          song: fields.song,
          artist: fields.artist,
          link: fields.link,
        },
      ],
    }
  }
  if (kind === 'entrance-party' && fields.entries.length === 0 && hasSong) {
    return {
      ...fields,
      song: '',
      artist: '',
      link: '',
      mode: 'whole',
      entries: [
        {
          id: 'whole',
          name: 'Wedding party',
          time: '',
          song: fields.song,
          artist: fields.artist,
          link: fields.link,
        },
      ],
    }
  }
  return fields
}

function readMoment(
  row: Record<string, unknown>,
  index: number,
): TimelineRow | null {
  const activity = clip(row.activity, SHORT)
  const presetKey =
    clip(row.presetKey, 80) || LEGACY_MOMENT[activity.toLowerCase()] || ''
  if (
    presetKey === 'cake' ||
    presetKey === 'dinner' ||
    /^(cake cutting|dinner music)$/i.test(activity)
  )
    return null
  const preset = MOMENTS.find((moment) => moment.key === presetKey)
  const songBits = timelineSong(row)
  const shared = {
    time: clip(row.time, 40),
    song: clip(row.song, SHORT),
    artist: clip(row.artist, SHORT),
    notes: songBits.notes,
    link: songBits.link,
    hidden: row.hidden === true,
    label: clip(row.label, SHORT),
    people: clip(row.people, SHORT),
    entries: readEntries(row.entries),
    mode: entranceMode(row.mode),
    direct: row.direct === true,
  }
  if (preset) {
    return {
      ...carryLegacySong(shared, preset.key),
      id: preset.key,
      presetKey: preset.key,
      section: preset.section,
      activity: preset.activity,
    }
  }
  const indexed =
    !activity && index >= 0 && index < MOMENTS.length
      ? MOMENTS[index]
      : undefined
  if (indexed && momentContent(row)) {
    return {
      ...carryLegacySong(shared, indexed.key),
      id: indexed.key,
      presetKey: indexed.key,
      section: indexed.section,
      activity: indexed.activity,
    }
  }
  if (/^other\b/i.test(activity) && !momentContent(row)) return null
  if (!momentContent(row) && !activity) return null
  const name = clip(row.label, SHORT) || activity || 'Added moment'
  return {
    ...shared,
    id: clip(row.id, 80) || `custom-${index + 1}`,
    presetKey: '',
    section: clip(row.section, SHORT) || 'Reception',
    activity: name,
    label: clip(row.label, SHORT),
  }
}

function normalizeTimeline(rows: Record<string, unknown>[]): TimelineRow[] {
  const legacy = !rows.some((row) =>
    MOMENTS.some((moment) => moment.key === row.presetKey),
  )
  const read = rows.flatMap((row, index) => {
    const moment = readMoment(row, index)
    return moment ? [moment] : []
  })
  const result: TimelineRow[] = []
  for (const section of ['Ceremony', 'Cocktail time', 'Reception']) {
    const presets = MOMENTS.filter((moment) => moment.section === section)
    const saved = read.filter(
      (row) =>
        row.section === section ||
        presets.some((moment) => moment.key === row.presetKey),
    )
    if (legacy || !presets.some((moment) => moment.sortable)) {
      for (const preset of presets) {
        result.push(
          saved.find((row) => row.presetKey === preset.key) ??
            blankMoment(preset),
        )
      }
      for (const custom of saved.filter((row) => row.presetKey === '')) {
        result.push(custom)
      }
      continue
    }
    const seen = new Set<string>()
    for (const row of saved) {
      if (row.presetKey) {
        if (seen.has(row.presetKey)) continue
        seen.add(row.presetKey)
      }
      result.push(row)
    }
    for (const preset of presets) {
      if (seen.has(preset.key)) continue
      const blank = blankMoment(preset)
      const later = presets
        .slice(presets.indexOf(preset) + 1)
        .map((item) => item.key)
      const at = result.findIndex(
        (row) => row.section === section && later.includes(row.presetKey),
      )
      if (at < 0) result.push(blank)
      else result.splice(at, 0, blank)
    }
  }
  const kept = new Set(
    result
      .filter((row) => row.presetKey === '')
      .slice(0, 12)
      .map((row) => row.id),
  )
  return result.filter((row) => row.presetKey !== '' || kept.has(row.id))
}

export function reorderMoments(
  timeline: TimelineRow[],
  section: string,
  fromId: string,
  toId: string,
): TimelineRow[] {
  if (!fromId || fromId === toId) return timeline
  const block = timeline.filter(
    (row) => row.section === section && row.presetKey !== 'cocktail-hour',
  )
  const from = block.findIndex((row) => row.id === fromId)
  const to = block.findIndex((row) => row.id === toId)
  if (from < 0 || to < 0) return timeline
  const nextBlock = block.slice()
  const [moved] = nextBlock.splice(from, 1)
  nextBlock.splice(to, 0, moved)
  let cursor = 0
  return timeline.map((row) => {
    if (row.section !== section || row.presetKey === 'cocktail-hour') return row
    const replacement = nextBlock[cursor]
    cursor += 1
    return replacement
  })
}

export function addCustomMoment(
  timeline: TimelineRow[],
  section: string,
  name: string,
): TimelineRow[] {
  const label = name.trim().slice(0, SHORT)
  if (!label) return timeline
  const customs = timeline.filter((row) => row.presetKey === '').length
  if (customs >= 12) return timeline
  const moment: TimelineRow = {
    id: `custom-${Date.now().toString(36)}`,
    presetKey: '',
    time: '',
    section,
    activity: label,
    song: '',
    artist: '',
    notes: '',
    link: '',
    hidden: false,
    label,
    people: '',
    entries: [],
    mode: '',
    direct: false,
  }
  const bouquet =
    section === 'Reception'
      ? timeline.findIndex((row) => row.presetKey === 'bouquet')
      : -1
  const last =
    bouquet >= 0
      ? bouquet
      : timeline.reduce(
          (found, row, index) => (row.section === section ? index : found),
          -1,
        )
  const next = timeline.slice()
  next.splice(last + 1, 0, moment)
  return next
}

function entryId(value: unknown, index: number): string {
  const id = clip(value, 40)
  return /^[\w-]{1,40}$/.test(id) ? id : `custom-${index + 1}`
}

function readEntries(value: unknown): MomentEntry[] {
  if (!Array.isArray(value)) return []
  const seen = new Set<string>()
  const entries: MomentEntry[] = []
  for (const [index, raw] of value.slice(0, ENTRY_MAX).entries()) {
    const item = asRecord(raw)
    const id = entryId(item.id, index)
    if (seen.has(id)) continue
    seen.add(id)
    entries.push({
      id,
      name: renamedEntry(clip(item.name, SHORT)),
      time: clip(item.time, 40),
      song: clip(item.song, SHORT),
      artist: clip(item.artist, SHORT),
      link: clip(item.link, LONG),
    })
  }
  return entries
}

/** Entries saved as "Whole wedding party" now read "Wedding party". */
function renamedEntry(name: string): string {
  return name === 'Whole wedding party' ? 'Wedding party' : name
}

function blankEntry(id: string, name = ''): MomentEntry {
  return { id, name, time: '', song: '', artist: '', link: '' }
}

function entranceMode(value: unknown): EntranceMode | '' {
  return value === 'pairs' || value === 'split' || value === 'whole'
    ? value
    : ''
}

export function isCustomEntry(entry: MomentEntry): boolean {
  return entry.id.startsWith('custom-')
}

/** The name a person sees for an entry, with a fallback when it is blank. */
export function entryName(entry: MomentEntry, fallback: string): string {
  return entry.name.trim() || fallback
}

export function entryHasSong(entry: {
  song: string
  artist: string
  link: string
}): boolean {
  return Boolean(entry.song.trim() || entry.artist.trim() || entry.link.trim())
}

export function patchEntry(
  entries: MomentEntry[],
  id: string,
  patch: Partial<Omit<MomentEntry, 'id'>>,
): MomentEntry[] {
  return entries.map((entry) =>
    entry.id === id ? { ...entry, ...patch } : entry,
  )
}

/** Tick or untick one of the processional choices. The couple can rename it after. */
export function togglePartyEntry(
  entries: MomentEntry[],
  id: string,
  on: boolean,
): MomentEntry[] {
  const option = PARTY_OPTIONS.find((item) => item.id === id)
  if (!option) return entries
  const has = entries.some((entry) => entry.id === id)
  if (!on) return entries.filter((entry) => entry.id !== id)
  if (has) return entries
  return [...entries, blankEntry(id, option.name)].slice(0, ENTRY_MAX)
}

/** A manual entry the couple types in themselves. */
export function addCustomEntry(
  entries: MomentEntry[],
  name = '',
): MomentEntry[] {
  if (entries.length >= ENTRY_MAX) return entries
  const id = `custom-${Date.now().toString(36)}${entries.length}`
  return [...entries, blankEntry(id, name.trim().slice(0, SHORT))]
}

export function removeEntry(entries: MomentEntry[], id: string): MomentEntry[] {
  return entries.filter((entry) => entry.id !== id)
}

function pairEntries(entries: MomentEntry[], count: number): MomentEntry[] {
  const total = Math.max(1, Math.min(PAIR_MAX, Math.floor(count) || 1))
  const pairs: MomentEntry[] = []
  for (let n = 1; n <= total; n += 1) {
    const found = entries.find((entry) => entry.id === `pair-${n}`)
    pairs.push(found ?? blankEntry(`pair-${n}`))
  }
  return pairs
}

/**
 * Choose how the wedding party comes in: in pairs (with how many), the
 * bridesmaids and groomsmen separately, or everyone together. Custom entries
 * the couple added stay; songs on entries that survive the switch stay too.
 */
export function setEntranceMode(
  entries: MomentEntry[],
  mode: EntranceMode,
  pairs = 2,
): MomentEntry[] {
  const customs = entries.filter(isCustomEntry)
  let standard: MomentEntry[]
  if (mode === 'pairs') standard = pairEntries(entries, pairs)
  else if (mode === 'split')
    standard = [
      // The ids stay for saved plans. New groups start neutral; couples name them.
      entries.find((entry) => entry.id === 'bridesmaids') ??
        blankEntry('bridesmaids', 'First group'),
      entries.find((entry) => entry.id === 'groomsmen') ??
        blankEntry('groomsmen', 'Second group'),
    ]
  else
    standard = [
      entries.find((entry) => entry.id === 'whole') ??
        blankEntry('whole', 'Wedding party'),
    ]
  return [...standard, ...customs].slice(0, ENTRY_MAX)
}

export function setPairCount(
  entries: MomentEntry[],
  count: number,
): MomentEntry[] {
  return setEntranceMode(entries, 'pairs', count)
}

export function pairCount(entries: MomentEntry[]): number {
  return entries.filter((entry) => entry.id.startsWith('pair-')).length
}

/** True when a moment has something filled in, whatever kind it is. */
export function momentFilled(row: TimelineRow): boolean {
  const kind = momentKind(row.presetKey)
  if (kind === 'time' || kind === 'time-notes') return row.time.trim() !== ''
  if (kind === 'speakers')
    return row.entries.some((entry) => entry.name.trim() !== '')
  if (kind === 'party' || kind === 'entrance-party')
    return row.entries.some(entryHasSong)
  return entryHasSong(row)
}

export function applyLiveInquiry(
  planning: Planning,
  seed: PlanningSeed,
): Planning {
  const next = { ...planning }
  for (const id of planning.fromInquiry) {
    const value = inquiryValue(seed, id)
    if (id === 'email') next.email = clip(value, SHORT)
    if (id === 'phone') next.phone = clip(value, 40)
    if (id === 'venueName') next.venueName = clip(value, SHORT)
    if (id === 'ceremonyAddress') next.ceremonyAddress = clip(value, LONG)
    if (id === 'receptionAddress') next.receptionAddress = clip(value, LONG)
  }
  return next
}

function mcTold(value: unknown): string {
  const next = clip(value, 40)
  // Yes/No now; the older wordings stay readable for plans saved before.
  if (
    next === 'Yes' ||
    next === 'No' ||
    next === 'Yes, they know' ||
    next === "Not yet, I'll tell them"
  )
    return next
  return ''
}

function inquiryList(value: unknown): string[] {
  if (!Array.isArray(value)) return []
  return INQUIRY_FIELDS.filter((id) => value.includes(id))
}

export function parsePlanning(
  stored: string | null | undefined,
  seed: PlanningSeed,
): { planning: Planning; saved: boolean } {
  if (!stored?.trim()) return { planning: blankPlanning(seed), saved: false }
  try {
    return {
      planning: applyLiveInquiry(
        planningFromUnknown(JSON.parse(stored) as unknown, seed),
        seed,
      ),
      saved: true,
    }
  } catch {
    return { planning: blankPlanning(seed), saved: false }
  }
}

const EMAIL_SHAPE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/**
 * Contact details the couple typed in the portal that the booking is missing.
 * Only fills blanks: a booking email or phone Piper already has is never
 * replaced from the portal.
 */
export function contactToFill(
  booking: { email: string; phone: string },
  planning: { email: string; phone: string },
): { email?: string; phone?: string } {
  const fill: { email?: string; phone?: string } = {}
  const email = planning.email.trim()
  if (!booking.email.trim() && EMAIL_SHAPE.test(email))
    fill.email = email.slice(0, 200)
  const phone = planning.phone.trim()
  if (!booking.phone.trim() && phone.replace(/\D/g, '').length >= 7)
    fill.phone = phone.slice(0, 40)
  return fill
}

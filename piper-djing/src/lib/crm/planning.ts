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
    activity: 'Bridal party processional',
    sortable: true,
  },
  {
    key: 'bride-processional',
    section: 'Ceremony',
    activity: "Bride's processional",
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
    activity: 'Grand entrance: whole wedding party',
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
    key: 'dinner',
    section: 'Reception',
    activity: 'Dinner music',
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
    activity: 'Mother/son dance',
    sortable: true,
  },
  {
    key: 'father-daughter',
    section: 'Reception',
    activity: 'Father/daughter dance',
    sortable: true,
  },
  {
    key: 'cake',
    section: 'Reception',
    activity: 'Cake cutting',
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
  songFrom: string
}

export type AppearanceRole = '' | 'entrance' | 'speech' | 'dance' | 'other'

export type AppearanceRow = {
  id: string
  names: string
  people: string
  when: string
  notes: string
  role: AppearanceRole
  song: string
  artist: string
  link: string
  walkUp: boolean
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
  mcToldFindDj: string
  fromInquiry: string[]
  entranceSongMode: 'one' | 'each'
  entranceSong: SongItem
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
const APPEARANCE_ROWS = 4
const APPEARANCE_MAX = 24

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
    appearances: Array.from({ length: APPEARANCE_ROWS }, (_, index) =>
      blankAppearance(`appearance-${index + 1}`),
    ),
    timeline: MOMENTS.map(blankMoment),
    mcContact: '',
    mcToldFindDj: '',
    fromInquiry: [...INQUIRY_FIELDS],
    entranceSongMode: 'each',
    entranceSong: { song: '', artist: '', link: '' },
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

function blankAppearance(id: string): AppearanceRow {
  return {
    id,
    names: '',
    people: '',
    when: '',
    notes: '',
    role: '',
    song: '',
    artist: '',
    link: '',
    walkUp: false,
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
    songFrom: '',
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
    appearances: appearances.slice(0, APPEARANCE_MAX).map((row, index) => {
      const item = asRecord(row)
      return {
        id: clip(item.id, 80) || `appearance-${index + 1}`,
        names: clip(item.names, SHORT),
        people: clip(item.people, SHORT),
        when: clip(item.when, SHORT),
        notes: clip(item.notes, LONG),
        role: appearanceRole(item.role),
        song: clip(item.song, SHORT),
        artist: clip(item.artist, SHORT),
        link: clip(item.link, LONG),
        walkUp: item.walkUp === true,
      }
    }),
    timeline: normalizeTimeline(timeline.map((row) => asRecord(row))),
    mcContact: clip(raw.mcContact, SHORT),
    mcToldFindDj: mcTold(raw.mcToldFindDj),
    fromInquiry: inquiryList(raw.fromInquiry),
    entranceSongMode: raw.entranceSongMode === 'one' ? 'one' : 'each',
    entranceSong: {
      song: clip(asRecord(raw.entranceSong).song, SHORT),
      artist: clip(asRecord(raw.entranceSong).artist, SHORT),
      link: clip(asRecord(raw.entranceSong).link, LONG),
    },
    genreChips: stringList(raw.genreChips, 24),
    mustPlayItems: songList(raw.mustPlayItems),
    doNotPlayItems: songList(raw.doNotPlayItems),
    receptionSame: raw.receptionSame === true,
    planLocked: raw.planLocked === true,
    dueDate: isoDate(raw.dueDate),
    djName: clip(raw.djName, SHORT),
    skipped: stringList(raw.skipped, 80).filter((id) => /^[\w-]{1,80}$/.test(id)),
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

const LEGACY_MOMENT: Record<string, string> = {
  'guest arrival & seating': 'guest-arrival',
  'bridal party processional': 'bridal-party',
  "bride's processional": 'bride-processional',
  'signing of the registry': 'registry',
  recessional: 'recessional',
  'cocktail hour': 'cocktail-hour',
  'grand entrance (whole wedding party)': 'entrance-party',
  'grand entrance: whole wedding party': 'entrance-party',
  'grand entrance (bride and groom)': 'entrance-couple',
  'grand entrance: the couple': 'entrance-couple',
  'first dance': 'first-dance',
  'dinner music': 'dinner',
  speeches: 'speeches',
  'mother/son dance': 'mother-son',
  'father/daughter dance': 'father-daughter',
  'cake cutting': 'cake',
  'bouquet toss': 'bouquet',
  'open dance floor': 'open-dance',
  'last dance': 'last-dance',
}

function momentContent(row: Record<string, unknown>): boolean {
  return Boolean(
    clip(row.time, 40) ||
    clip(row.song, SHORT) ||
    clip(row.artist, SHORT) ||
    clip(row.notes, LONG) ||
    clip(row.link, LONG) ||
    clip(row.label, SHORT) ||
    clip(row.people, SHORT),
  )
}

function readMoment(
  row: Record<string, unknown>,
  index: number,
): TimelineRow | null {
  const activity = clip(row.activity, SHORT)
  const presetKey =
    clip(row.presetKey, 80) || LEGACY_MOMENT[activity.toLowerCase()] || ''
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
    songFrom: clip(row.songFrom, 80),
  }
  if (preset) {
    return {
      ...shared,
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
      ...shared,
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
    songFrom: '',
  }
  const last = timeline.reduce(
    (found, row, index) => (row.section === section ? index : found),
    -1,
  )
  const next = timeline.slice()
  next.splice(last + 1, 0, moment)
  return next
}

function songOf(row: { song: string; artist: string; link: string }): boolean {
  return Boolean(row.song.trim() || row.artist.trim() || row.link.trim())
}

function writeSong(
  row: TimelineRow,
  song: { song: string; artist: string; link: string },
  source: string,
): TimelineRow {
  return {
    ...row,
    song: song.song,
    artist: song.artist,
    link: song.link,
    songFrom: source,
  }
}

export function syncAppearanceSongs(planning: Planning): Planning {
  let timeline = planning.timeline.map((row) =>
    row.songFrom
      ? { ...row, song: '', artist: '', link: '', songFrom: '' }
      : row,
  )
  const applyPreset = (
    key: string,
    song: { song: string; artist: string; link: string },
    source: string,
  ) => {
    timeline = timeline.map((row) =>
      row.presetKey === key ? writeSong(row, song, source) : row,
    )
  }
  if (planning.entranceSongMode === 'one' && songOf(planning.entranceSong)) {
    applyPreset('entrance-party', planning.entranceSong, 'entrance')
    applyPreset('entrance-couple', planning.entranceSong, 'entrance')
  } else {
    for (const row of planning.appearances) {
      if (row.role !== 'entrance' || !songOf(row)) continue
      const key = entrancePreset(row, planning.coupleNames)
      if (key) applyPreset(key, row, row.id)
    }
  }
  for (const row of planning.appearances) {
    if (row.role !== 'dance' || !row.names.trim()) continue
    const preset = MOMENTS.find(
      (moment) =>
        moment.section === 'Reception' &&
        namesMatch(row.names, moment.activity),
    )
    if (preset && songOf(row)) {
      applyPreset(preset.key, row, row.id)
      continue
    }
    const id = `dance-${row.id}`
    timeline = timeline.filter((moment) => moment.id !== id || moment.presetKey)
    if (!songOf(row)) continue
    timeline = addCustomMoment(timeline, 'Reception', row.names).map(
      (moment) =>
        moment.activity === row.names &&
        moment.presetKey === '' &&
        !moment.songFrom
          ? { ...writeSong(moment, row, row.id), id }
          : moment,
    )
  }
  timeline = timeline.filter(
    (row) =>
      row.presetKey !== '' || !row.id.startsWith('dance-') || row.songFrom,
  )
  return { ...planning, timeline }
}

function entrancePreset(
  row: AppearanceRow,
  coupleNames: string,
): string | null {
  const names = `${row.names} ${row.people}`.toLowerCase()
  if (/wedding party|bridal party|whole party/.test(names))
    return 'entrance-party'
  if (/bride and groom|bride & groom|the couple/.test(names))
    return 'entrance-couple'
  const parts = coupleNames
    .toLowerCase()
    .split(/\s+and\s+|\s+&\s+/)
    .map((part) => part.trim())
    .filter((part) => part.length > 1)
  if (
    parts.length > 0 &&
    parts.every((part) => names.includes(part.split(' ')[0] ?? part))
  ) {
    return 'entrance-couple'
  }
  return null
}

function namesMatch(left: string, right: string): boolean {
  return left.trim().toLowerCase() === right.trim().toLowerCase()
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

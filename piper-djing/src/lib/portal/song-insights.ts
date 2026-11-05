import { MOMENTS } from '../crm/planning.ts'
import type { Planning, SongItem } from '../crm/planning.ts'

/**
 * The desk Songs page: every song and music choice couples made in their
 * portals, gathered across the book. Pure, so it is tested without a database.
 */

export type SongPlan = {
  bookingId: number
  couple: string
  eventDate: string
  planning: Planning
}

/** One song a couple picked, and where in the night it goes. */
export type SongPick = {
  bookingId: number
  couple: string
  eventDate: string
  /** "Must play", a moment ("First dance"), or "Do not play". */
  where: string
  /** For a moment: who it is for, when the couple named them (a speaker, a group). */
  forWho: string
  /** Where it falls in the night (must-play and added moments go last). */
  order: number
  song: string
  artist: string
  link: string
}

export type SongCount = {
  song: string
  artist: string
  link: string
  count: number
  couples: string[]
  where: string[]
}

export type CoupleMusic = {
  bookingId: number
  couple: string
  eventDate: string
  genres: string[]
  vibe: string
  guestRequests: string
  dedications: string
  playlists: { name: string; link: string }[]
  specialPlaylists: string
  picks: number
}

export type SongInsights = {
  couples: number
  couplesWithMusic: number
  picks: SongPick[]
  doNotPlay: SongPick[]
  top: SongCount[]
  topDoNotPlay: SongCount[]
  genres: { name: string; count: number }[]
  guestRequests: { choice: string; count: number }[]
  moments: { name: string; picks: SongPick[] }[]
  perCouple: CoupleMusic[]
}

export const MUST_PLAY = 'Must play'
export const DO_NOT_PLAY = 'Do not play'

const PLAYLISTS = [
  ['preCeremony', 'Pre-ceremony'],
  ['cocktail', 'Cocktail'],
  ['dinner', 'Dinner'],
  ['dance', 'Dance'],
] as const

function clean(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

/** The list a couple built, or the older one-box answer when the list is empty. */
function listOf(items: readonly SongItem[], legacy: string): SongItem[] {
  const filled = items.filter((item) => clean(item.song) || clean(item.link))
  if (filled.length) return filled
  return legacy
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((song) => ({ song, artist: '', link: '' }))
}

function pick(
  plan: SongPlan,
  where: string,
  item: { song: string; artist: string; link: string },
  forWho = '',
  order = 999,
): SongPick | null {
  const song = clean(item.song)
  const link = clean(item.link)
  if (!song && !link) return null
  return {
    bookingId: plan.bookingId,
    couple: plan.couple,
    eventDate: plan.eventDate,
    where,
    forWho: forWho.trim(),
    order,
    song: song || link,
    artist: clean(item.artist),
    link,
  }
}

/** Every song in one plan, in the order of the night, then the must-play list. */
export function picksFromPlan(plan: SongPlan): {
  picks: SongPick[]
  doNotPlay: SongPick[]
} {
  const picks: SongPick[] = []
  const order = new Map(MOMENTS.map((moment, index) => [moment.key, index]))
  const rows = [...plan.planning.timeline]
    .filter((row) => !row.hidden)
    .sort(
      (left, right) =>
        (order.get(left.presetKey) ?? 99) - (order.get(right.presetKey) ?? 99),
    )
  for (const row of rows) {
    const where = clean(row.label) || clean(row.activity) || 'Added moment'
    const at = order.get(row.presetKey) ?? 99
    const own = pick(plan, where, row, '', at)
    if (own) picks.push(own)
    for (const entry of row.entries ?? []) {
      const found = pick(plan, where, entry, entry.name, at)
      if (found) picks.push(found)
    }
  }
  for (const item of listOf(plan.planning.mustPlayItems, plan.planning.mustPlay)) {
    const found = pick(plan, MUST_PLAY, item)
    if (found) picks.push(found)
  }
  const doNotPlay = listOf(
    plan.planning.doNotPlayItems,
    plan.planning.doNotPlay,
  )
    .map((item) => pick(plan, DO_NOT_PLAY, item))
    .filter((row): row is SongPick => row !== null)
  return { picks, doNotPlay }
}

function songKey(row: { song: string; artist: string }): string {
  const plain = (value: string) =>
    value
      .toLowerCase()
      .replace(/[’']/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim()
  return `${plain(row.song)}|${plain(row.artist)}`
}

/** The same song picked by several couples, most picked first. */
export function countSongs(rows: readonly SongPick[]): SongCount[] {
  const grouped = new Map<string, SongCount>()
  for (const row of rows) {
    const key = songKey(row)
    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, {
        song: row.song,
        artist: row.artist,
        link: row.link,
        count: 1,
        couples: [row.couple],
        where: [row.where],
      })
      continue
    }
    if (!current.couples.includes(row.couple)) {
      current.couples.push(row.couple)
      current.count += 1
    }
    if (!current.where.includes(row.where)) current.where.push(row.where)
    if (!current.link && row.link) current.link = row.link
    if (!current.artist && row.artist) current.artist = row.artist
  }
  return [...grouped.values()].sort(
    (left, right) =>
      right.count - left.count || left.song.localeCompare(right.song),
  )
}

function tally(values: readonly string[]): { name: string; count: number }[] {
  const counts = new Map<string, { name: string; count: number }>()
  for (const value of values) {
    const name = value.trim()
    if (!name) continue
    const key = name.toLowerCase()
    const current = counts.get(key)
    if (current) current.count += 1
    else counts.set(key, { name, count: 1 })
  }
  return [...counts.values()].sort(
    (left, right) => right.count - left.count || left.name.localeCompare(right.name),
  )
}

export function songInsights(plans: readonly SongPlan[]): SongInsights {
  const picks: SongPick[] = []
  const doNotPlay: SongPick[] = []
  const perCouple: CoupleMusic[] = []
  for (const plan of plans) {
    const found = picksFromPlan(plan)
    picks.push(...found.picks)
    doNotPlay.push(...found.doNotPlay)
    const planning = plan.planning
    perCouple.push({
      bookingId: plan.bookingId,
      couple: plan.couple,
      eventDate: plan.eventDate,
      genres: planning.genreChips.map(clean).filter(Boolean),
      vibe: [clean(planning.genres), clean(planning.mood)].filter(Boolean).join('\n'),
      guestRequests: clean(planning.guestRequests),
      dedications: clean(planning.dedications),
      playlists: PLAYLISTS.map(([key, name]) => ({
        name,
        link: clean(planning[key]),
      })).filter((row) => row.link),
      specialPlaylists: clean(planning.specialPlaylists),
      picks: found.picks.length + found.doNotPlay.length,
    })
  }
  const byMoment = new Map<string, SongPick[]>()
  for (const row of picks) {
    if (row.where === MUST_PLAY) continue
    byMoment.set(row.where, [...(byMoment.get(row.where) ?? []), row])
  }
  const music = perCouple.filter(
    (row) =>
      row.picks > 0 ||
      row.genres.length > 0 ||
      row.vibe ||
      row.guestRequests ||
      row.playlists.length > 0,
  )
  return {
    couples: plans.length,
    couplesWithMusic: music.length,
    picks,
    doNotPlay,
    top: countSongs(picks),
    topDoNotPlay: countSongs(doNotPlay),
    genres: tally(perCouple.flatMap((row) => row.genres)),
    guestRequests: tally(perCouple.map((row) => row.guestRequests)).map(
      (row) => ({ choice: row.name, count: row.count }),
    ),
    moments: [...byMoment.entries()]
      .map(([name, rows]) => ({ name, picks: rows }))
      .sort(
        (left, right) =>
          Math.min(...left.picks.map((row) => row.order)) -
          Math.min(...right.picks.map((row) => row.order)),
      ),
    perCouple,
  }
}

function csvCell(value: string): string {
  const text = value.replace(/\r?\n/g, ' ')
  return /[",]/.test(text) || /^[=+\-@]/.test(text)
    ? `"${(/^[=+\-@]/.test(text) ? `'${text}` : text).replace(/"/g, '""')}"`
    : text
}

/** Every pick as a spreadsheet: one row per song. */
export function songsCsv(insights: SongInsights): string {
  const header = ['Couple', 'Wedding date', 'Where', 'For', 'Song', 'Artist', 'Link']
  const rows = [...insights.picks, ...insights.doNotPlay].map((row) => [
    row.couple,
    row.eventDate,
    row.where,
    row.forWho,
    row.song,
    row.artist,
    row.link,
  ])
  return [header, ...rows].map((row) => row.map(csvCell).join(',')).join('\r\n')
}

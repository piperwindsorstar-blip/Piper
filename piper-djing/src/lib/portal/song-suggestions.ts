import type { SongHit } from './song-search.ts'

const CEREMONY = [
  'guest-arrival',
  'bridal-party',
  'bride-processional',
  'registry',
  'recessional',
] as const

const PARENTS = ['mother-son', 'father-daughter'] as const

export type ChosenSong = {
  presetKey: string
  song: string
  artist: string
  link: string
  hidden: boolean
}

export type PlanSongs = {
  slug: string
  sample: boolean
  timeline: readonly ChosenSong[]
}

export function suggestionHeading(presetKey: string): string {
  if (isCeremony(presetKey)) return "Other couples' ceremony songs so far"
  if (presetKey === 'first-dance') return "Other couples' first dances"
  if (isParent(presetKey)) return "Other couples' parent dances"
  return ''
}

export function songsFromPlans(
  plans: readonly PlanSongs[],
  slug: string,
): ChosenSong[] {
  const chosen: ChosenSong[] = []
  for (const plan of plans) {
    if (plan.sample || plan.slug === slug) continue
    for (const row of plan.timeline) {
      if (row.hidden || !row.presetKey || !row.song.trim()) continue
      chosen.push({
        presetKey: row.presetKey,
        song: row.song.trim(),
        artist: row.artist.trim(),
        link: row.link.trim(),
        hidden: false,
      })
    }
  }
  return chosen
}

export function rankSuggestions(
  presetKey: string,
  chosen: readonly ChosenSong[],
): SongHit[] {
  const pool = poolFor(presetKey)
  if (!pool) return []
  const grouped = new Map<
    string,
    { hit: SongHit; count: number; same: boolean }
  >()
  for (const row of chosen) {
    if (!pool.has(row.presetKey)) continue
    const title = row.song.trim()
    if (!title) continue
    const artist = row.artist.trim()
    const key = `${title.toLowerCase()}|${artist.toLowerCase()}`
    const same = row.presetKey === presetKey
    const link = row.link.trim()
    const current = grouped.get(key)
    if (!current) {
      grouped.set(key, {
        hit: {
          title: title.slice(0, 120),
          artist: artist.slice(0, 120),
          link: link.slice(0, 300),
        },
        count: 1,
        same,
      })
      continue
    }
    current.count += 1
    if (same) current.same = true
    if (link && (same || !current.hit.link)) {
      current.hit = { ...current.hit, link: link.slice(0, 300) }
    }
  }
  return [...grouped.values()]
    .sort((left, right) => {
      if (right.count !== left.count) return right.count - left.count
      if (right.same !== left.same)
        return Number(right.same) - Number(left.same)
      return left.hit.title.localeCompare(right.hit.title)
    })
    .slice(0, 5)
    .map((row) => row.hit)
}

function poolFor(presetKey: string): Set<string> | null {
  if (isCeremony(presetKey)) return new Set(CEREMONY)
  if (presetKey === 'first-dance') return new Set(['first-dance'])
  if (isParent(presetKey)) return new Set(PARENTS)
  return null
}

function isCeremony(presetKey: string): boolean {
  return CEREMONY.some((key) => key === presetKey)
}

function isParent(presetKey: string): boolean {
  return PARENTS.some((key) => key === presetKey)
}

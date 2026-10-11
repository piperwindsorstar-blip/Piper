export type SongHit = {
  title: string
  artist: string
  link: string
}

export function isSongLink(value: string): boolean {
  const trimmed = value.trim()
  if (!/^https?:\/\//i.test(trimmed)) return false
  try {
    const url = new URL(trimmed)
    return url.protocol === 'http:' || url.protocol === 'https:'
  } catch {
    return false
  }
}

export function songHits(payload: unknown): SongHit[] {
  if (!payload || typeof payload !== 'object') return []
  const results = Reflect.get(payload, 'results')
  if (!Array.isArray(results)) return []
  const hits: SongHit[] = []
  for (const item of results) {
    if (!item || typeof item !== 'object') continue
    const title = textField(item, 'trackName')
    const artist = textField(item, 'artistName')
    const link = textField(item, 'trackViewUrl')
    if (!title || !artist) continue
    hits.push({
      title: title.slice(0, 120),
      artist: artist.slice(0, 120),
      link: link.slice(0, 300),
    })
    if (hits.length === 6) break
  }
  return hits
}

export async function lookupSongs(query: string): Promise<SongHit[]> {
  const term = query.trim().slice(0, 80)
  if (term.length < 2 || isSongLink(term)) return []
  const url = new URL('https://itunes.apple.com/search')
  url.searchParams.set('term', term)
  url.searchParams.set('entity', 'song')
  url.searchParams.set('limit', '6')
  url.searchParams.set('country', 'CA')
  const response = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!response.ok) return []
  return songHits(await response.json())
}

function textField(value: object, key: string): string {
  const raw = Reflect.get(value, key)
  return typeof raw === 'string' ? raw.trim() : ''
}

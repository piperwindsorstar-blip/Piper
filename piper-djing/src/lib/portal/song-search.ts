export type SongHit = {
  title: string
  artist: string
  link: string
}

const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const SEARCH_URL = 'https://api.spotify.com/v1/search'
/** Apple's public music search. No keys, so it works when Spotify is not set up. */
const ITUNES_URL = 'https://itunes.apple.com/search'
/** Deezer's public search, also keyless: the last resort. */
const DEEZER_URL = 'https://api.deezer.com/search/track'
const AGENT = 'PiperDJing/1.0 (+https://piperpweddingdj.services)'
const TOKEN_REFRESH_MS = 60_000

type SpotifyEnv = {
  SPOTIFY_CLIENT_ID?: unknown
  SPOTIFY_CLIENT_SECRET?: unknown
}

type CachedToken = {
  clientId: string
  value: string
  expiresAt: number
}

let cachedToken: CachedToken | null = null
let tokenRequest: Promise<string> | null = null

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

/** Reads a Spotify search payload (`tracks.items`). */
export function songHits(payload: unknown): SongHit[] {
  if (!payload || typeof payload !== 'object') return []
  const tracks = Reflect.get(payload, 'tracks')
  if (!tracks || typeof tracks !== 'object') return []
  const items = Reflect.get(tracks, 'items')
  if (!Array.isArray(items)) return []
  const hits: SongHit[] = []
  for (const item of items) {
    if (!item || typeof item !== 'object') continue
    const title = textField(item, 'name')
    const artist = artistNames(item)
    if (!title || !artist) continue
    hits.push({
      title: title.slice(0, 120),
      artist: artist.slice(0, 120),
      link: spotifyLink(item).slice(0, 300),
    })
    if (hits.length === 6) break
  }
  return hits
}

/** Reads an Apple (iTunes) search payload (`results`). */
export function itunesHits(payload: unknown): SongHit[] {
  if (!payload || typeof payload !== 'object') return []
  const results = Reflect.get(payload, 'results')
  if (!Array.isArray(results)) return []
  const hits: SongHit[] = []
  const seen = new Set<string>()
  for (const item of results) {
    if (!item || typeof item !== 'object') continue
    const title = textField(item, 'trackName')
    const artist = textField(item, 'artistName')
    if (!title || !artist) continue
    const key = `${title.toLowerCase()}|${artist.toLowerCase()}`
    if (seen.has(key)) continue
    seen.add(key)
    const link = textField(item, 'trackViewUrl')
    hits.push({
      title: title.slice(0, 120),
      artist: artist.slice(0, 120),
      link: /^https:\/\//.test(link) ? link.slice(0, 300) : '',
    })
    if (hits.length === 6) break
  }
  return hits
}

async function searchItunes(term: string): Promise<SongHit[]> {
  try {
    const url = new URL(ITUNES_URL)
    url.searchParams.set('term', term)
    url.searchParams.set('media', 'music')
    url.searchParams.set('entity', 'song')
    url.searchParams.set('limit', '10')
    url.searchParams.set('country', 'CA')
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': AGENT },
    })
    if (!response.ok) return []
    return itunesHits(JSON.parse(await response.text()))
  } catch {
    return []
  }
}

/**
 * Song search for the portal: Spotify when its keys are set, and Apple's
 * public search when they are not or Spotify finds nothing.
 */
export async function lookupSongs(query: string): Promise<SongHit[]> {
  const term = query.trim().slice(0, 80)
  if (term.length < 2 || isSongLink(term)) return []
  const spotify = await searchSpotify(term)
  if (spotify.length > 0) return spotify
  const apple = await searchItunes(term)
  if (apple.length > 0) return apple
  return searchDeezer(term)
}

/** Reads a Deezer search payload (`data`). */
export function deezerHits(payload: unknown): SongHit[] {
  if (!payload || typeof payload !== 'object') return []
  const data = Reflect.get(payload, 'data')
  if (!Array.isArray(data)) return []
  const hits: SongHit[] = []
  for (const item of data) {
    if (!item || typeof item !== 'object') continue
    const title = textField(item, 'title')
    const artistRow = Reflect.get(item, 'artist')
    const artist =
      artistRow && typeof artistRow === 'object' ? textField(artistRow, 'name') : ''
    if (!title || !artist) continue
    const link = textField(item, 'link')
    hits.push({
      title: title.slice(0, 120),
      artist: artist.slice(0, 120),
      link: /^https:\/\//.test(link) ? link.slice(0, 300) : '',
    })
    if (hits.length === 6) break
  }
  return hits
}

async function searchDeezer(term: string): Promise<SongHit[]> {
  try {
    const url = new URL(DEEZER_URL)
    url.searchParams.set('q', term)
    url.searchParams.set('limit', '6')
    const response = await fetch(url, {
      headers: { Accept: 'application/json', 'User-Agent': AGENT },
    })
    if (!response.ok) return []
    return deezerHits(await response.json())
  } catch {
    return []
  }
}

async function searchSpotify(term: string): Promise<SongHit[]> {
  const creds = spotifyCredentials()
  if (!creds) return []
  try {
    const token = await accessToken(creds)
    if (!token) return []
    const url = new URL(SEARCH_URL)
    url.searchParams.set('q', term)
    url.searchParams.set('type', 'track')
    url.searchParams.set('limit', '6')
    url.searchParams.set('market', 'CA')
    const response = await fetch(url, {
      headers: {
        Accept: 'application/json',
        Authorization: `Bearer ${token}`,
      },
    })
    if (response.status === 401) cachedToken = null
    if (!response.ok) return []
    return songHits(await response.json())
  } catch {
    return []
  }
}

function spotifyCredentials(): { id: string; secret: string } | null {
  const fromWorker = (globalThis as { __env__?: SpotifyEnv }).__env__
  const id =
    credential(fromWorker?.SPOTIFY_CLIENT_ID) ||
    credential(process.env.SPOTIFY_CLIENT_ID)
  const secret =
    credential(fromWorker?.SPOTIFY_CLIENT_SECRET) ||
    credential(process.env.SPOTIFY_CLIENT_SECRET)
  if (!id || !secret) return null
  return { id, secret }
}

function credential(value: unknown): string {
  return typeof value === 'string' ? value.trim() : ''
}

async function accessToken(creds: {
  id: string
  secret: string
}): Promise<string> {
  const fresh = readCachedToken(creds.id)
  if (fresh) return fresh
  if (!tokenRequest) {
    tokenRequest = requestToken(creds).finally(() => {
      tokenRequest = null
    })
  }
  return tokenRequest
}

function readCachedToken(clientId: string): string {
  if (!cachedToken || cachedToken.clientId !== clientId) return ''
  if (cachedToken.expiresAt - Date.now() <= TOKEN_REFRESH_MS) return ''
  return cachedToken.value
}

async function requestToken(creds: {
  id: string
  secret: string
}): Promise<string> {
  const response = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: {
      Accept: 'application/json',
      Authorization: `Basic ${basicToken(creds.id, creds.secret)}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({ grant_type: 'client_credentials' }),
  })
  if (!response.ok) return ''
  const payload: unknown = await response.json()
  if (!payload || typeof payload !== 'object') return ''
  const value = textField(payload, 'access_token')
  const expiresIn = numberField(payload, 'expires_in')
  if (!value) return ''
  cachedToken = {
    clientId: creds.id,
    value,
    expiresAt: Date.now() + Math.max(expiresIn, 0) * 1000,
  }
  return value
}

function basicToken(id: string, secret: string): string {
  const bytes = new TextEncoder().encode(`${id}:${secret}`)
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function artistNames(item: object): string {
  const artists = Reflect.get(item, 'artists')
  if (!Array.isArray(artists)) return ''
  const names: string[] = []
  for (const artist of artists) {
    if (!artist || typeof artist !== 'object') continue
    const name = textField(artist, 'name')
    if (!name) continue
    names.push(name)
    if (names.length === 3) break
  }
  return names.join(', ')
}

function spotifyLink(item: object): string {
  const urls = Reflect.get(item, 'external_urls')
  if (!urls || typeof urls !== 'object') return ''
  return textField(urls, 'spotify')
}

function textField(value: object, key: string): string {
  const raw = Reflect.get(value, key)
  return typeof raw === 'string' ? raw.trim() : ''
}

function numberField(value: object, key: string): number {
  const raw = Reflect.get(value, key)
  return typeof raw === 'number' && Number.isFinite(raw) ? raw : 0
}

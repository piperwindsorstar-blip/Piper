import {
  PLACE_FIELDS,
  parsePlaceDetails,
  parsePlaceSearch,
} from './google-reviews.ts'
import type { GoogleReviews, PlaceCandidate } from './google-reviews.ts'

/**
 * Google reviews, fetched in the Worker only: the API key never reaches a
 * browser. One Place Details call is kept for a day (in memory and in the
 * Worker's Cache API), which keeps the site well inside Google's free usage.
 * A failed call is remembered for an hour so a Google outage is not retried
 * on every page view.
 */

const KEEP_MS = 24 * 60 * 60 * 1000
const RETRY_MS = 60 * 60 * 1000
const CACHE_URL = 'https://piperpweddingdj.services/__cache/google-reviews'

type Stored = { at: number; ok: boolean; reviews: GoogleReviews | null; error: string }

let memory: Stored | null = null

function cacheStorage(): Cache | null {
  const storage = (globalThis as { caches?: { default?: Cache } }).caches
  return storage?.default ?? null
}

function config(): { key: string; placeId: string } | null {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim() ?? ''
  const placeId = process.env.GOOGLE_PLACE_ID?.trim() ?? ''
  if (!key || !placeId) return null
  return { key, placeId }
}

function current(stored: Stored | null): boolean {
  if (!stored) return false
  const age = Date.now() - stored.at
  return age < (stored.ok ? KEEP_MS : RETRY_MS)
}

async function readCache(): Promise<Stored | null> {
  if (current(memory)) return memory
  const cache = cacheStorage()
  if (!cache) return null
  try {
    const hit = await cache.match(CACHE_URL)
    if (!hit) return null
    const stored = (await hit.json()) as Stored
    if (!current(stored)) return null
    memory = stored
    return stored
  } catch {
    return null
  }
}

async function writeCache(stored: Stored): Promise<void> {
  memory = stored
  const cache = cacheStorage()
  if (!cache) return
  const seconds = Math.round((stored.ok ? KEEP_MS : RETRY_MS) / 1000)
  try {
    await cache.put(
      CACHE_URL,
      new Response(JSON.stringify(stored), {
        headers: {
          'content-type': 'application/json',
          'cache-control': `public, max-age=${seconds}`,
        },
      }),
    )
  } catch {
    // Memory still holds it for this copy of the Worker.
  }
}

async function fetchJson(
  url: string,
  init: RequestInit,
): Promise<{ ok: true; body: unknown } | { ok: false; error: string }> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 6000)
  try {
    const response = await fetch(url, { ...init, signal: controller.signal })
    const body = (await response.json().catch(() => null)) as unknown
    if (!response.ok) {
      const message =
        (body as { error?: { message?: string } } | null)?.error?.message ??
        `Google answered ${response.status}.`
      return { ok: false, error: message.slice(0, 300) }
    }
    return { ok: true, body }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error && error.name === 'AbortError'
          ? 'Google did not answer in time.'
          : 'Google could not be reached.',
    }
  } finally {
    clearTimeout(timer)
  }
}

async function fetchFromGoogle(): Promise<Stored> {
  const settings = config()
  if (!settings) {
    return {
      at: Date.now(),
      ok: false,
      reviews: null,
      error:
        'GOOGLE_PLACES_API_KEY and GOOGLE_PLACE_ID are not set on the Worker yet.',
    }
  }
  const result = await fetchJson(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(settings.placeId)}?languageCode=en`,
    {
      headers: {
        'X-Goog-Api-Key': settings.key,
        'X-Goog-FieldMask': PLACE_FIELDS,
      },
    },
  )
  if (!result.ok) {
    return { at: Date.now(), ok: false, reviews: null, error: result.error }
  }
  const reviews = parsePlaceDetails(
    result.body,
    settings.placeId,
    new Date().toISOString(),
  )
  return {
    at: Date.now(),
    ok: true,
    reviews,
    error: reviews ? '' : 'Google returned no reviews with text for this place.',
  }
}

/** What the public pages show: Google's reviews, or null to hide the section. */
export async function readGoogleReviews(): Promise<GoogleReviews | null> {
  try {
    const cached = await readCache()
    if (cached) return cached.reviews
    const fresh = await fetchFromGoogle()
    await writeCache(fresh)
    return fresh.reviews
  } catch {
    return null
  }
}

export type GoogleStatus = {
  configured: boolean
  ok: boolean
  error: string
  rating: number
  count: number
  shown: number
  fetchedAt: string
  mapsUri: string
}

function statusOf(stored: Stored): GoogleStatus {
  return {
    configured: config() !== null,
    ok: stored.ok && stored.reviews !== null,
    error: stored.error,
    rating: stored.reviews?.rating ?? 0,
    count: stored.reviews?.count ?? 0,
    shown: stored.reviews?.reviews.length ?? 0,
    fetchedAt: new Date(stored.at).toISOString(),
    mapsUri: stored.reviews?.mapsUri ?? '',
  }
}

/** For the desk: what the site is showing, without a fresh call. */
export async function googleStatus(): Promise<GoogleStatus> {
  const cached = await readCache()
  if (cached) return statusOf(cached)
  const fresh = await fetchFromGoogle()
  await writeCache(fresh)
  return statusOf(fresh)
}

/** For the desk: fetch again now, after changing the Place ID or key. */
export async function refreshGoogleReviews(): Promise<GoogleStatus> {
  const fresh = await fetchFromGoogle()
  await writeCache(fresh)
  return statusOf(fresh)
}

/** For the desk: find the Place ID for the business by name. */
export async function searchGooglePlaces(
  textQuery: string,
): Promise<{ ok: true; places: PlaceCandidate[] } | { ok: false; error: string }> {
  const key = process.env.GOOGLE_PLACES_API_KEY?.trim() ?? ''
  if (!key) {
    return {
      ok: false,
      error: 'Add GOOGLE_PLACES_API_KEY to the Worker first, then search.',
    }
  }
  const result = await fetchJson(
    'https://places.googleapis.com/v1/places:searchText',
    {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask':
          'places.id,places.displayName,places.formattedAddress,places.rating,places.userRatingCount',
      },
      body: JSON.stringify({ textQuery: textQuery.slice(0, 200) }),
    },
  )
  if (!result.ok) return result
  return { ok: true, places: parsePlaceSearch(result.body) }
}

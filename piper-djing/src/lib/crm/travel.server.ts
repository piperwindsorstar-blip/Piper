import { query } from '../db.server.ts'
import { addressKey, kmFromRoutes, routableAddress, routesRequest } from './travel.ts'

/**
 * Driving distance from home, through the Google Routes API, in the Worker
 * only. The key (GOOGLE_MAPS_API_KEY) never reaches the browser. Each address
 * is cached for 30 days; a miss is remembered for a day so a bad address does
 * not call Google on every save.
 */

const CACHE = `CREATE TABLE IF NOT EXISTS travel_cache (
  address_key text PRIMARY KEY,
  km_tenths integer,
  ok integer NOT NULL DEFAULT 0,
  detail text NOT NULL DEFAULT '',
  fetched_at bigint NOT NULL DEFAULT 0
)`

const DAY_MS = 86_400_000
const KEEP_FOUND_MS = 30 * DAY_MS
const KEEP_MISS_MS = DAY_MS

export type DistanceResult =
  | { ok: true; km: number; cached: boolean }
  | { ok: false; reason: 'no-key' | 'no-address' | 'not-found' | 'error'; detail: string }

export function mapsConfigured(): boolean {
  return Boolean(process.env.GOOGLE_MAPS_API_KEY?.trim())
}

export async function drivingKm(address: string, now = Date.now()): Promise<DistanceResult> {
  if (!routableAddress(address)) {
    return { ok: false, reason: 'no-address', detail: 'No venue address yet.' }
  }
  const key = process.env.GOOGLE_MAPS_API_KEY?.trim()
  if (!key) {
    return { ok: false, reason: 'no-key', detail: 'GOOGLE_MAPS_API_KEY is not set.' }
  }
  const cacheKey = addressKey(address)
  try {
    await query(CACHE)
    const rows = await query<{
      km_tenths: unknown
      ok: unknown
      detail: string
      fetched_at: unknown
    }>('SELECT km_tenths, ok, detail, fetched_at FROM travel_cache WHERE address_key = $1', [
      cacheKey,
    ])
    const row = rows.at(0)
    if (row) {
      const age = now - Number(row.fetched_at ?? 0)
      const found = Number(row.ok) === 1
      if (found && age < KEEP_FOUND_MS) {
        return { ok: true, km: Number(row.km_tenths) / 10, cached: true }
      }
      if (!found && age < KEEP_MISS_MS) {
        return { ok: false, reason: 'not-found', detail: row.detail || 'No route found.' }
      }
    }
  } catch {
    // The cache is a saving, never a blocker.
  }

  let result: DistanceResult
  try {
    const request = routesRequest(address, key)
    const response = await fetch(request.url, request.init)
    const body = (await response.json().catch(() => null)) as unknown
    const km = response.ok ? kmFromRoutes(body) : null
    if (km != null) {
      result = { ok: true, km, cached: false }
    } else if (response.ok) {
      result = { ok: false, reason: 'not-found', detail: 'Google found no driving route to that address.' }
    } else {
      const message = googleError(body, response.status)
      console.warn('[travel] routes refused:', message)
      // A bad request is usually an address Google cannot place.
      result =
        response.status === 400
          ? { ok: false, reason: 'not-found', detail: message.slice(0, 200) }
          : { ok: false, reason: 'error', detail: message.slice(0, 200) }
    }
  } catch (error) {
    result = {
      ok: false,
      reason: 'error',
      detail: error instanceof Error ? error.message.slice(0, 200) : 'Google could not be reached.',
    }
  }

  // Remember found routes and real misses; a network or key error is not cached.
  if (result.ok || result.reason === 'not-found') {
    try {
      await query(
        `INSERT INTO travel_cache (address_key, km_tenths, ok, detail, fetched_at)
         VALUES ($1, $2, $3, $4, $5)
         ON CONFLICT (address_key) DO UPDATE SET
           km_tenths = EXCLUDED.km_tenths, ok = EXCLUDED.ok,
           detail = EXCLUDED.detail, fetched_at = EXCLUDED.fetched_at`,
        [
          cacheKey,
          result.ok ? Math.round(result.km * 10) : null,
          result.ok ? 1 : 0,
          result.ok ? '' : result.detail,
          now,
        ],
      )
    } catch {
      // Not cached this time; the next save asks again.
    }
  }
  return result
}

/**
 * Google's message plus its reason code (API_KEY_SERVICE_BLOCKED,
 * SERVICE_DISABLED, API_KEY_HTTP_REFERRER_BLOCKED...), which names the fix.
 */
function googleError(body: unknown, status: number): string {
  const error = (body as { error?: { message?: unknown; details?: unknown } } | null)?.error
  const message = typeof error?.message === 'string' ? error.message : `HTTP ${status}`
  const details = Array.isArray(error?.details) ? error.details : []
  const reason = details
    .map((item) => (item as { reason?: unknown })?.reason)
    .find((value): value is string => typeof value === 'string')
  return reason ? `${message} (${reason})` : message
}

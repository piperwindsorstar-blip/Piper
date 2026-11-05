import { query } from '../db.server.ts'
import {
  HOME_ADDRESS,
  addressKey,
  kmFromOrsRoute,
  kmFromRoutes,
  orsErrorText,
  orsGeocodeUrl,
  orsRouteRequest,
  pointFromOrsGeocode,
  routableAddress,
  routesRequest,
} from './travel.ts'

/**
 * Driving distance from home, worked out in the Worker only: OpenRouteService
 * (ORS_API_KEY, OpenStreetMap data) first, then the Google Routes API
 * (GOOGLE_MAPS_API_KEY) as a backup. Neither key reaches the browser. Each address
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

function orsKey(): string {
  return process.env.ORS_API_KEY?.trim() ?? ''
}

function googleKey(): string {
  return process.env.GOOGLE_MAPS_API_KEY?.trim() ?? ''
}

export function mapsConfigured(): boolean {
  return Boolean(orsKey() || googleKey())
}

export async function drivingKm(address: string, now = Date.now()): Promise<DistanceResult> {
  if (!routableAddress(address)) {
    return { ok: false, reason: 'no-address', detail: 'No venue address yet.' }
  }
  const ors = orsKey()
  const google = googleKey()
  if (!ors && !google) {
    return { ok: false, reason: 'no-key', detail: 'ORS_API_KEY is not set.' }
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

  let result: DistanceResult = { ok: false, reason: 'error', detail: 'Not tried.' }
  if (ors) result = await orsKm(address, ors)
  // Google only steps in when ORS is missing or down, never to overrule a real miss.
  if (google && (!ors || (!result.ok && result.reason === 'error'))) {
    const backup = await googleKm(address, google)
    if (backup.ok || !ors) result = backup
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

async function orsJson(url: string, init?: RequestInit): Promise<{ status: number; ok: boolean; body: unknown }> {
  const response = await fetch(url, init)
  const body = (await response.json().catch(() => null)) as unknown
  return { status: response.status, ok: response.ok, body }
}

/** Home's map point, looked up once per Worker instance. */
let homePoint: Promise<[number, number] | null> | null = null

async function orsPoint(address: string, key: string): Promise<[number, number] | null> {
  const reply = await orsJson(orsGeocodeUrl(address, key))
  if (!reply.ok) throw new Error(`OpenRouteService: ${orsErrorText(reply.body, reply.status)}`)
  return pointFromOrsGeocode(reply.body)
}

async function orsKm(address: string, key: string): Promise<DistanceResult> {
  try {
    homePoint ??= orsPoint(HOME_ADDRESS, key).catch((error: unknown) => {
      homePoint = null
      throw error
    })
    const [from, to] = await Promise.all([homePoint, orsPoint(address, key)])
    if (!from) {
      homePoint = null
      return { ok: false, reason: 'error', detail: 'OpenRouteService could not place the home address.' }
    }
    if (!to) {
      return { ok: false, reason: 'not-found', detail: 'OpenRouteService could not find that address.' }
    }
    const request = orsRouteRequest(from, to, key)
    const reply = await orsJson(request.url, request.init)
    const km = reply.ok ? kmFromOrsRoute(reply.body) : null
    if (km != null) return { ok: true, km, cached: false }
    if (reply.ok || reply.status === 404) {
      return { ok: false, reason: 'not-found', detail: 'No driving route to that address.' }
    }
    const message = orsErrorText(reply.body, reply.status)
    console.warn('[travel] ors refused:', message)
    return { ok: false, reason: 'error', detail: `OpenRouteService: ${message}`.slice(0, 200) }
  } catch (error) {
    return {
      ok: false,
      reason: 'error',
      detail: (error instanceof Error ? error.message : 'OpenRouteService could not be reached.').slice(0, 200),
    }
  }
}

async function googleKm(address: string, key: string): Promise<DistanceResult> {
  try {
    const request = routesRequest(address, key)
    const response = await fetch(request.url, request.init)
    const body = (await response.json().catch(() => null)) as unknown
    const km = response.ok ? kmFromRoutes(body) : null
    if (km != null) return { ok: true, km, cached: false }
    if (response.ok) {
      return { ok: false, reason: 'not-found', detail: 'Google found no driving route to that address.' }
    }
    const message = googleError(body, response.status)
    console.warn('[travel] routes refused:', message)
    // A bad request is usually an address Google cannot place.
    return response.status === 400
      ? { ok: false, reason: 'not-found', detail: message.slice(0, 200) }
      : { ok: false, reason: 'error', detail: `Google: ${message}`.slice(0, 200) }
  } catch (error) {
    return {
      ok: false,
      reason: 'error',
      detail: error instanceof Error ? error.message.slice(0, 200) : 'Google could not be reached.',
    }
  }
}

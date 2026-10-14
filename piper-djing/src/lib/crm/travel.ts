import type { PackageId } from './defaults.ts'
import { HOME_BASE } from './home-base.ts'
import {
  TRAVEL_FAR_CENTS,
  TRAVEL_HOTEL_OVER_KM,
  TRAVEL_INCLUDED_UNDER_KM,
  TRAVEL_NEAR_CENTS,
  TRAVEL_NEAR_THROUGH_KM,
} from '../piper/rules.ts'

/**
 * Automatic travel. Pure rules, shared by the desk, /book and the bot API.
 * Distance is the one-way driving distance from home to the main venue.
 * The tiers are the ones in the terms; they are not changed here.
 */

export const HOME_ADDRESS = `${HOME_BASE}, Brantford, ON, Canada`

export type TravelTier = 'included' | 'near' | 'far' | 'hotel' | 'ceremony'

export type TravelSource = '' | 'auto' | 'manual' | 'failed'

export type TravelFigure = {
  /** One-way km to one decimal, or null when it could not be found. */
  km: number | null
  tier: TravelTier | null
  /** The travel fee in cents, or null (blank) when the distance is unknown. */
  feeCents: number | null
  hotel: boolean
}

export const TRAVEL_TIER_LABEL: Record<TravelTier, string> = {
  included: 'Included (under 50 km)',
  near: '50 to 100 km',
  far: 'Over 100 km, up to 200 km',
  hotel: 'Over 200 km, hotel required',
  ceremony: 'Included with The Aisle',
}

/** Metres from the Routes API as km to one decimal. */
export function roundKm(meters: number): number {
  return Math.round(meters / 100) / 10
}

/** The tier and fee for a distance. The Aisle always includes travel. */
export function travelFromKm(km: number, packageId: PackageId | string): TravelFigure {
  if (!Number.isFinite(km) || km < 0) {
    return { km: null, tier: null, feeCents: null, hotel: false }
  }
  if (packageId === 'ceremony') {
    return { km, tier: 'ceremony', feeCents: 0, hotel: false }
  }
  if (km < TRAVEL_INCLUDED_UNDER_KM) {
    return { km, tier: 'included', feeCents: 0, hotel: false }
  }
  if (km <= TRAVEL_NEAR_THROUGH_KM) {
    return { km, tier: 'near', feeCents: TRAVEL_NEAR_CENTS, hotel: false }
  }
  if (km <= TRAVEL_HOTEL_OVER_KM) {
    return { km, tier: 'far', feeCents: TRAVEL_FAR_CENTS, hotel: false }
  }
  return { km, tier: 'hotel', feeCents: TRAVEL_FAR_CENTS, hotel: true }
}

/** One key per address, so "12 Main St" and "12  main st " share a cache row. */
export function addressKey(address: string): string {
  return address.trim().toLowerCase().replace(/\s+/g, ' ').replace(/\s*,\s*/g, ', ')
}

/** Enough of an address to route to: a street with a number, or a full place. */
export function routableAddress(address: string): boolean {
  const clean = address.trim()
  return clean.length >= 6 && /[a-z]/i.test(clean)
}

/** The computeRoutes request: one DRIVE route, distance only. */
export function routesRequest(address: string, key: string): {
  url: string
  init: RequestInit
} {
  return {
    url: 'https://routes.googleapis.com/directions/v2:computeRoutes',
    init: {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-goog-api-key': key,
        'x-goog-fieldmask': 'routes.distanceMeters',
        // Lets a key restricted to the website's address work from the server.
        referer: 'https://piperpweddingdj.services/',
      },
      body: JSON.stringify({
        origin: { address: HOME_ADDRESS },
        destination: { address: address.trim() },
        travelMode: 'DRIVE',
        units: 'METRIC',
        regionCode: 'ca',
        languageCode: 'en-CA',
      }),
    },
  }
}

/** The one-way km from a computeRoutes reply, or null when there is no route. */
export function kmFromRoutes(body: unknown): number | null {
  if (!body || typeof body !== 'object') return null
  const routes = (body as { routes?: unknown }).routes
  if (!Array.isArray(routes) || routes.length === 0) return null
  const meters = Number((routes[0] as { distanceMeters?: unknown }).distanceMeters)
  if (!Number.isFinite(meters) || meters <= 0) return null
  return roundKm(meters)
}

export const TRAVEL_FAILED_TEXT = "Couldn't find distance, enter manually."

/** "Distance: 82.4 km (auto)" for the desk. */
export function distanceLabel(km: number | null, source: TravelSource): string {
  if (source === 'failed' || km == null) {
    return source === 'failed' ? TRAVEL_FAILED_TEXT : 'Distance: not worked out yet'
  }
  const how = source === 'manual' ? 'manual' : 'auto'
  return `Distance: ${km.toFixed(1)} km (${how})`
}

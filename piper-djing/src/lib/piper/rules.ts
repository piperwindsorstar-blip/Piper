import type { PackageId } from '../crm/defaults.ts'

/** Wired uplights are $15 each. */
export const UPLIGHT_CENTS = 1500

/** A hold lasts 30 days, counting the day it starts. */
export const HOLD_DAYS = 30

/** Deposit steps are $25. */
const DEPOSIT_STEP_CENTS = 2500

export const PACKAGE_CENTS: Record<PackageId, number> = {
  full: 165000,
  reception: 155000,
  stag: 70000,
  ceremony: 35000,
}

/** Ceremony only is paid in full. An invoice cannot lower this. */
export const CEREMONY_DEPOSIT_CENTS = PACKAGE_CENTS.ceremony

/** The Pre-Party on its own is a flat $350 deposit. */
export const STAG_DEPOSIT_CENTS = 35000

/** A full wedding day plus a stag is one booking, deposited at $500. */
export const FULL_PLUS_STAG_DEPOSIT_CENTS = 50000

/**
 * One-way driving distance. Under 50 km is included. 50–100 km is $110.
 * Over 100 km, up to 200 km, is $250. Over 200 km is $250 plus a hotel.
 */
export const TRAVEL_INCLUDED_UNDER_KM = 50
export const TRAVEL_NEAR_THROUGH_KM = 100
export const TRAVEL_HOTEL_OVER_KM = 200
export const TRAVEL_NEAR_CENTS = 11000
export const TRAVEL_FAR_CENTS = 25000

export const TRAVEL_BANDS =
  'Under 50 km is included. From 50 km to 100 km is $110. Over 100 km, up to 200 km, is $250. Over 200 km is $250 plus a hotel. The Aisle, ceremony only, includes travel.'

export const BLOCKED_DATE = '2027-02-20'

const BLOCKED_NAMES = [
  ['avery', 'test'],
  ['blake', 'sample'],
]

/**
 * 30% of the total, to the nearest $25. A remainder that lands exactly halfway
 * rounds down.
 */
export function deposit30(totalCents: number): number {
  if (!Number.isInteger(totalCents) || totalCents < 0) {
    throw new Error('Money is whole cents.')
  }
  const valueTenths = totalCents * 3
  const stepTenths = DEPOSIT_STEP_CENTS * 10
  const steps = Math.floor(valueTenths / stepTenths)
  const remainder = valueTenths - steps * stepTenths
  const rounded = remainder * 2 > stepTenths ? steps + 1 : steps
  return rounded * DEPOSIT_STEP_CENTS
}

export function uplightCents(count: number): number {
  if (!Number.isInteger(count) || count < 0) {
    throw new Error('Uplight count is a whole number.')
  }
  return count * UPLIGHT_CENTS
}

export type TravelCharge = {
  cents: number
  hotel: boolean
}

/** Travel is calculated from one-way kilometres. It is not a typed flat fee. */
export function travelCents(oneWayKm: number): number {
  return travelCharge(oneWayKm).cents
}

export function travelCharge(oneWayKm: number): TravelCharge {
  if (!Number.isFinite(oneWayKm) || oneWayKm < 0) {
    throw new Error('Distance is a number of kilometres.')
  }
  if (oneWayKm < TRAVEL_INCLUDED_UNDER_KM) return { cents: 0, hotel: false }
  if (oneWayKm <= TRAVEL_NEAR_THROUGH_KM) {
    return { cents: TRAVEL_NEAR_CENTS, hotel: false }
  }
  return {
    cents: TRAVEL_FAR_CENTS,
    hotel: oneWayKm > TRAVEL_HOTEL_OVER_KM,
  }
}

export function travelForVenues(oneWayKm: number[]): TravelCharge {
  if (oneWayKm.length > 2) {
    throw new Error('Two venues maximum.')
  }
  return oneWayKm.reduce<TravelCharge>(
    (sum, km) => {
      const charge = travelCharge(km)
      return {
        cents: sum.cents + charge.cents,
        hotel: sum.hotel || charge.hotel,
      }
    },
    { cents: 0, hotel: false },
  )
}

export function torontoToday(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

function addDays(iso: string, days: number): string {
  const [year = 0, month = 1, day = 1] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, month - 1, day))
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

export function holdLastDay(start: string): string {
  return addDays(start, HOLD_DAYS - 1)
}

/** True when `day` falls inside the inclusive 30-day hold that started on `start`. */
export function holdCovers(start: string, day: string): boolean {
  const end = holdLastDay(start)
  return day >= start && day <= end
}

export function nameWords(value: string): string[] {
  return value
    .toLowerCase()
    .replace(/&/g, ' and ')
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((word) => word && word !== 'and')
}

export function isRejectedName(
  partnerOne: string,
  partnerTwo: string,
): boolean {
  const words = nameWords(`${partnerOne} ${partnerTwo}`)
  return BLOCKED_NAMES.some((blocked) =>
    blocked.every((word) => words.includes(word)),
  )
}

export function isBlockedDate(
  eventDate: string,
  stagDate: string | null,
): boolean {
  return eventDate === BLOCKED_DATE || stagDate === BLOCKED_DATE
}

export function requiredDeposit(input: {
  packageId: PackageId
  withStag: boolean
  invoiceDepositCents: number
}): number {
  if (input.packageId === 'ceremony') return CEREMONY_DEPOSIT_CENTS
  if (input.packageId === 'stag') return STAG_DEPOSIT_CENTS
  if (input.packageId === 'full' && input.withStag)
    return FULL_PLUS_STAG_DEPOSIT_CENTS
  return input.invoiceDepositCents
}

export function quote(
  input: {
    packageId: PackageId
    withStag: boolean
    uplights: number
    venueKm: number[]
  },
  prices: Record<PackageId, number> = PACKAGE_CENTS,
): { totalCents: number; depositCents: number; hotel: boolean } {
  if (input.withStag && input.packageId !== 'full') {
    throw new Error('A stag is added to the full wedding day.')
  }
  const packageCents =
    input.packageId === 'full' && input.withStag
      ? prices.full + prices.stag
      : prices[input.packageId]
  const travel =
    input.packageId === 'ceremony'
      ? { cents: 0, hotel: false }
      : travelForVenues(input.venueKm)
  const totalCents = packageCents + uplightCents(input.uplights) + travel.cents
  const depositCents =
    input.packageId === 'ceremony'
      ? prices.ceremony
      : input.packageId === 'stag'
        ? Math.min(STAG_DEPOSIT_CENTS, totalCents)
        : input.packageId === 'full' && input.withStag
          ? Math.min(FULL_PLUS_STAG_DEPOSIT_CENTS, totalCents)
          : deposit30(totalCents)
  return { totalCents, depositCents, hotel: travel.hotel }
}

/** A custom discount comes off the quoted total. The deposit is calculated again. */
export function applyDiscount(
  quoted: { totalCents: number; depositCents: number; hotel: boolean },
  discountCents: number,
  shape: { packageId: PackageId; withStag: boolean },
): {
  totalCents: number
  depositCents: number
  discountCents: number
  hotel: boolean
} {
  if (!Number.isInteger(discountCents) || discountCents < 0) {
    throw new Error('The discount is a whole amount.')
  }
  if (discountCents === 0) return { ...quoted, discountCents: 0 }
  if (discountCents > quoted.totalCents) {
    throw new Error('That discount is larger than the total.')
  }
  const totalCents = quoted.totalCents - discountCents
  const depositCents =
    shape.packageId === 'ceremony'
      ? totalCents
      : shape.packageId === 'stag'
        ? Math.min(STAG_DEPOSIT_CENTS, totalCents)
        : shape.packageId === 'full' && shape.withStag
          ? Math.min(FULL_PLUS_STAG_DEPOSIT_CENTS, totalCents)
          : deposit30(totalCents)
  return { totalCents, depositCents, discountCents, hotel: quoted.hotel }
}

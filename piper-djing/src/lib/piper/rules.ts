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

/** A full wedding day plus a stag is one booking, deposited at $500. */
export const FULL_PLUS_STAG_DEPOSIT_CENTS = 50000

/** The first 20 km from home are included. Past that, travel is per kilometre. */
export const TRAVEL_FREE_KM = 20
export const TRAVEL_CENTS_PER_KM = 150

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

/** Travel is calculated from kilometres. It is not a typed flat fee. */
export function travelCents(oneWayKm: number): number {
  if (!Number.isFinite(oneWayKm) || oneWayKm < 0) {
    throw new Error('Distance is a number of kilometres.')
  }
  if (oneWayKm <= TRAVEL_FREE_KM) return 0
  return Math.round((oneWayKm - TRAVEL_FREE_KM) * TRAVEL_CENTS_PER_KM)
}

export function travelForVenues(oneWayKm: number[]): number {
  if (oneWayKm.length > 2) {
    throw new Error('Two venues maximum.')
  }
  return oneWayKm.reduce((sum, km) => sum + travelCents(km), 0)
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
  const [year, month, day] = iso.split('-').map(Number)
  const date = new Date(Date.UTC(year, (month ?? 1) - 1, day ?? 1))
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
): { totalCents: number; depositCents: number } {
  if (input.withStag && input.packageId !== 'full') {
    throw new Error('A stag is added to the full wedding day.')
  }
  const packageCents =
    input.packageId === 'full' && input.withStag
      ? prices.full + prices.stag
      : prices[input.packageId]
  const totalCents =
    packageCents + uplightCents(input.uplights) + travelForVenues(input.venueKm)
  const depositCents =
    input.packageId === 'ceremony'
      ? prices.ceremony
      : input.packageId === 'full' && input.withStag
        ? FULL_PLUS_STAG_DEPOSIT_CENTS
        : deposit30(totalCents)
  return { totalCents, depositCents }
}

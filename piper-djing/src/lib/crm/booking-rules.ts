import type { PackageId } from './defaults.ts'
import {
  applyDiscount,
  CEREMONY_DEPOSIT_CENTS,
  FULL_PLUS_STAG_DEPOSIT_CENTS,
  holdCovers,
  isBlockedDate,
  isRejectedName,
  nameWords,
  quote,
  requiredDeposit,
  torontoToday,
} from '../piper/rules.ts'

export type BookingStatus =
  'open' | 'hold' | 'booked' | 'cancelled' | 'released'

export type InvoiceStatus = 'draft' | 'sent' | 'void'

export type WeddingInput = {
  partnerOne: string
  partnerTwo: string
  eventDate: string
  stagDate: string | null
  packageId: PackageId
  withStag: boolean
  uplights: number
  venueKm: number[]
  venueName: string
  venueStreet: string
  sample: boolean
  discountCents?: number
}

export type BookingState = WeddingInput & {
  status: BookingStatus
  totalCents: number
  depositCents: number
  holdStartedOn: string | null
  stagReleased: boolean
}

export type InvoiceState = {
  status: InvoiceStatus
  totalCents: number
  depositCents: number
  receivedCents: number
}

export type CustomWedding = {
  names: [string, string]
  date: string
  totalCents: number
  depositClearedCents: number
}

export type SavedWedding = CustomWedding & {
  partnerOne: string
  partnerTwo: string
  venueName: string
  city: string
}

/**
 * These four weddings keep the totals already cleared. Same names on another date are ordinary.
 * Venue names come from the previous desk. Streets, emails, and phone numbers were not on that record.
 */
export const SAVED_WEDDINGS: SavedWedding[] = [
  {
    names: ['cj', 'laura'],
    partnerOne: 'CJ',
    partnerTwo: 'Laura',
    date: '2027-03-12',
    venueName: 'Rivers Edge',
    city: 'Paris',
    totalCents: 100000,
    depositClearedCents: 30000,
  },
  {
    names: ['kevin', 'jasmine'],
    partnerOne: 'Kevin',
    partnerTwo: 'Jasmine',
    date: '2027-06-05',
    venueName: 'Oakwood Resort',
    city: 'Grand Bend',
    totalCents: 170000,
    depositClearedCents: 50000,
  },
  {
    names: ['lance', 'diana'],
    partnerOne: 'Lance',
    partnerTwo: 'Diana',
    date: '2027-06-20',
    venueName: 'Rivers Edge',
    city: 'Paris',
    totalCents: 130000,
    depositClearedCents: 30000,
  },
  {
    names: ['cobi', 'cameron'],
    partnerOne: 'Cobi',
    partnerTwo: 'Cameron',
    date: '2027-07-17',
    venueName: 'The Lavender Farm',
    city: '',
    totalCents: 140000,
    depositClearedCents: 40000,
  },
]

export const CUSTOM_WEDDINGS: CustomWedding[] = SAVED_WEDDINGS

export function savedWeddingNote(wedding: SavedWedding): string {
  const place = [wedding.venueName, wedding.city].filter(Boolean).join(', ')
  return `Transferred from the previous book. ${place}. The agreed total stays.`
}

export function matchCustom(
  partnerOne: string,
  partnerTwo: string,
  eventDate: string,
): CustomWedding | null {
  const words = nameWords(`${partnerOne} ${partnerTwo}`)
  return (
    CUSTOM_WEDDINGS.find(
      (wedding) =>
        wedding.date === eventDate &&
        wedding.names.every((name) => words.includes(name)),
    ) ?? null
  )
}

export function figuresFor(
  input: WeddingInput,
  prices?: Record<PackageId, number>,
): {
  totalCents: number
  depositCents: number
  discountCents: number
} {
  const discountCents = input.discountCents ?? 0
  const custom = matchCustom(
    input.partnerOne,
    input.partnerTwo,
    input.eventDate,
  )
  if (custom) {
    if (discountCents > 0) throw new Error('That agreed total stays.')
    return {
      totalCents: custom.totalCents,
      depositCents: custom.depositClearedCents,
      discountCents: 0,
    }
  }
  return applyDiscount(quote(input, prices), discountCents, {
    packageId: input.packageId,
    withStag: input.withStag,
  })
}

export function assertBookableNames(
  partnerOne: string,
  partnerTwo: string,
): void {
  if (isRejectedName(partnerOne, partnerTwo)) {
    throw new Error('Those names are not booked.')
  }
}

export function assertBookableDate(
  eventDate: string,
  stagDate: string | null,
): void {
  if (isBlockedDate(eventDate, stagDate)) {
    throw new Error('20 February 2027 is not booked.')
  }
}

export function invoiceBalance(invoice: InvoiceState): number {
  if (invoice.status === 'void') return 0
  return Math.max(0, invoice.totalCents - invoice.receivedCents)
}

export type Transition = {
  booking: BookingState
  invoice: InvoiceState
  newlyBooked: boolean
}

function bookIfCovered(
  booking: BookingState,
  invoice: InvoiceState,
  ceremonyCents = CEREMONY_DEPOSIT_CENTS,
): Transition {
  if (booking.status === 'booked') {
    return { booking, invoice, newlyBooked: false }
  }
  const discount = booking.discountCents ?? 0
  const required =
    booking.packageId === 'ceremony'
      ? discount > 0
        ? invoice.depositCents
        : Math.max(ceremonyCents, invoice.depositCents)
      : booking.packageId === 'full' && booking.withStag
        ? discount > 0
          ? Math.min(FULL_PLUS_STAG_DEPOSIT_CENTS, invoice.depositCents)
          : FULL_PLUS_STAG_DEPOSIT_CENTS
        : requiredDeposit({
            packageId: booking.packageId,
            withStag: booking.withStag,
            invoiceDepositCents: invoice.depositCents,
          })
  const covered =
    invoice.status === 'sent' &&
    invoice.totalCents > 0 &&
    required > 0 &&
    invoice.receivedCents >= required &&
    (booking.status === 'hold' || booking.status === 'open')
  if (!covered || booking.status !== 'hold') {
    return { booking, invoice, newlyBooked: false }
  }
  return {
    booking: { ...booking, status: 'booked' },
    invoice,
    newlyBooked: true,
  }
}

/**
 * A hold starts only when a live invoice is marked sent and the booking has
 * a venue name and a street. The hold date is that Toronto day.
 */
export function markInvoiceSent(
  booking: BookingState,
  invoice: InvoiceState,
  now = new Date(),
  ceremonyCents = CEREMONY_DEPOSIT_CENTS,
): Transition {
  if (invoice.status === 'void') {
    return { booking, invoice, newlyBooked: false }
  }
  const today = torontoToday(now)
  const sent: InvoiceState = { ...invoice, status: 'sent' }
  let next = booking
  if (
    booking.status === 'open' &&
    booking.venueName.trim() &&
    booking.venueStreet.trim()
  ) {
    next = { ...booking, status: 'hold', holdStartedOn: today }
  }
  return bookIfCovered(next, sent, ceremonyCents)
}

export function invoiceControls(status: string | null): {
  send: boolean
  canVoid: boolean
  blocked: string | null
} {
  if (status == null) {
    return {
      send: false,
      canVoid: false,
      blocked: 'That booking has no invoice.',
    }
  }
  if (status === 'void') {
    return {
      send: false,
      canVoid: false,
      blocked: 'A void invoice stays void.',
    }
  }
  return { send: true, canVoid: true, blocked: null }
}

export function voidInvoice(
  booking: BookingState,
  invoice: InvoiceState,
): Transition {
  return {
    booking,
    invoice: { ...invoice, status: 'void' },
    newlyBooked: false,
  }
}

/** Payments and refunds never unbook a date. */
export function recordMoney(
  booking: BookingState,
  invoice: InvoiceState,
  cents: number,
  ceremonyCents = CEREMONY_DEPOSIT_CENTS,
): Transition {
  const receivedCents = Math.max(0, invoice.receivedCents + cents)
  return bookIfCovered(booking, { ...invoice, receivedCents }, ceremonyCents)
}

export function releaseBooking(
  booking: BookingState,
  invoice: InvoiceState,
): Transition {
  return {
    booking: { ...booking, status: 'released' },
    invoice,
    newlyBooked: false,
  }
}

export function cancelBooking(
  booking: BookingState,
  invoice: InvoiceState,
): Transition {
  return {
    booking: { ...booking, status: 'cancelled' },
    invoice,
    newlyBooked: false,
  }
}

export function dateIsTaken(
  rows: BookingState[],
  day: string,
  today = torontoToday(),
): boolean {
  return rows.some((row) => {
    if (row.sample) return false
    if (row.status !== 'hold' && row.status !== 'booked') return false
    const active =
      row.status === 'booked' ||
      (row.holdStartedOn != null && holdCovers(row.holdStartedOn, today))
    if (!active) return false
    if (row.eventDate === day) return true
    if (row.stagDate === day && !row.stagReleased) return true
    return false
  })
}

export function countedCents(rows: BookingState[]): number {
  return rows
    .filter(
      (row) =>
        !row.sample && row.status !== 'cancelled' && row.status !== 'released',
    )
    .reduce((sum, row) => sum + row.totalCents, 0)
}

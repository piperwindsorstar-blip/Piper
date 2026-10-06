import type { PackageId } from './defaults.ts'
import {
  holdCovers,
  isBlockedDate,
  isRejectedName,
  nameWords,
  quote,
  requiredDeposit,
  torontoToday,
} from '../piper/rules.ts'

export type BookingStatus = 'open' | 'hold' | 'booked' | 'cancelled' | 'released'

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

/** These four weddings keep the totals already cleared. Same names on another date are ordinary. */
export const CUSTOM_WEDDINGS: CustomWedding[] = [
  { names: ['cj', 'laura'], date: '2027-03-12', totalCents: 100000, depositClearedCents: 30000 },
  { names: ['kevin', 'jasmine'], date: '2027-06-05', totalCents: 170000, depositClearedCents: 50000 },
  { names: ['lance', 'diana'], date: '2027-06-20', totalCents: 130000, depositClearedCents: 30000 },
  { names: ['cobi', 'cameron'], date: '2027-07-17', totalCents: 140000, depositClearedCents: 40000 },
]

export function matchCustom(partnerOne: string, partnerTwo: string, eventDate: string): CustomWedding | null {
  const words = nameWords(`${partnerOne} ${partnerTwo}`)
  return (
    CUSTOM_WEDDINGS.find(
      (wedding) =>
        wedding.date === eventDate && wedding.names.every((name) => words.includes(name)),
    ) ?? null
  )
}

export function figuresFor(input: WeddingInput): { totalCents: number; depositCents: number } {
  const custom = matchCustom(input.partnerOne, input.partnerTwo, input.eventDate)
  if (custom) {
    return { totalCents: custom.totalCents, depositCents: custom.depositClearedCents }
  }
  return quote(input)
}

export function assertBookableNames(partnerOne: string, partnerTwo: string): void {
  if (isRejectedName(partnerOne, partnerTwo)) {
    throw new Error('Those names are not booked.')
  }
}

export function assertBookableDate(eventDate: string, stagDate: string | null): void {
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

function bookIfCovered(booking: BookingState, invoice: InvoiceState): Transition {
  if (booking.status === 'booked') {
    return { booking, invoice, newlyBooked: false }
  }
  const required = requiredDeposit({
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
  return bookIfCovered(next, sent)
}

export function voidInvoice(booking: BookingState, invoice: InvoiceState): Transition {
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
): Transition {
  const receivedCents = Math.max(0, invoice.receivedCents + cents)
  return bookIfCovered(booking, { ...invoice, receivedCents })
}

export function releaseBooking(booking: BookingState, invoice: InvoiceState): Transition {
  return {
    booking: { ...booking, status: 'released' },
    invoice,
    newlyBooked: false,
  }
}

export function cancelBooking(booking: BookingState, invoice: InvoiceState): Transition {
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
    const active = row.status === 'booked' || (row.holdStartedOn != null && holdCovers(row.holdStartedOn, today))
    if (!active) return false
    if (row.eventDate === day) return true
    if (row.stagDate === day && !row.stagReleased) return true
    return false
  })
}

export function countedCents(rows: BookingState[]): number {
  return rows
    .filter((row) => !row.sample && row.status !== 'cancelled' && row.status !== 'released')
    .reduce((sum, row) => sum + row.totalCents, 0)
}

import { longDate } from './dates.ts'
import { PUBLIC_EMAIL } from './defaults.ts'
import { cad } from './money.ts'

export type LetterInvoice = {
  slug: string
  status: string
  totalCents: number
  depositCents: number
  receivedCents: number
  balanceCents: number
}

/** Fields the letter may read. Venue streets are accepted and never printed. */
export type LetterBooking = {
  partnerOne: string
  partnerTwo: string
  eventDate: string
  stagDate: string | null
  packageName: string
  withStag: boolean
  venueName: string
  venueStreet: string
  venueTwoName: string
  venueTwoStreet: string
  sample: boolean
  status: string
  totalCents: number
  depositCents: number
  slug: string
  holdStartedOn: string | null
  holdLastDay: string | null
  stagReleased: boolean
  invoice: LetterInvoice | null
}

export type Letter = {
  subject: string
  text: string
}

const STATUS_LABEL: Record<string, string> = {
  open: 'Open',
  hold: 'On hold',
  booked: 'Booked',
  cancelled: 'Cancelled',
  released: 'Released',
  draft: 'Draft',
  sent: 'Sent',
  void: 'Void',
}

export function hasCoupleAddress(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
}

export function coupleAddress(email: string): string {
  const trimmed = email.trim()
  if (!hasCoupleAddress(trimmed)) {
    throw new Error('This booking has no email address.')
  }
  return trimmed
}

export function bookingLetter(
  booking: LetterBooking,
  url: (path: string) => string,
): Letter {
  const received = booking.invoice?.receivedCents ?? 0
  const balance = booking.invoice?.balanceCents ?? booking.totalCents
  const lines = [
    greeting(booking),
    '',
    sampleLine(booking),
    `Package: ${booking.packageName}${booking.withStag ? ', with a stag and doe' : ''}`,
    `Date: ${longDate(booking.eventDate)}`,
    stagLine(booking),
    `Status: ${label(booking.status)}`,
    holdLine(booking),
    venueLine('Venue', booking.venueName),
    venueLine('Second venue', booking.venueTwoName),
    '',
    moneyBlock(
      booking.invoice?.totalCents ?? booking.totalCents,
      booking.invoice?.depositCents ?? booking.depositCents,
      received,
      balance,
    ),
    '',
    `Your page: ${url(`/c/${booking.slug}`)}`,
    'Your planning form is on that page.',
    booking.invoice ? `Invoice: ${url(`/p/${booking.invoice.slug}`)}` : '',
    '',
    signOff(),
  ]
  return {
    subject: subject('Your date with Piper DJing', booking.sample),
    text: compact(lines),
  }
}

export function invoiceLetter(
  booking: LetterBooking,
  url: (path: string) => string,
): Letter {
  const invoice = booking.invoice
  if (!invoice) throw new Error('This booking has no invoice.')
  const lines = [
    greeting(booking),
    '',
    sampleLine(booking),
    `Your invoice is ${label(invoice.status).toLowerCase()}.`,
    invoice.status === 'void'
      ? 'This invoice is void. The balance is zero.'
      : '',
    `Date: ${longDate(booking.eventDate)}`,
    `Package: ${booking.packageName}`,
    '',
    moneyBlock(
      invoice.totalCents,
      invoice.depositCents,
      invoice.receivedCents,
      invoice.balanceCents,
    ),
    '',
    `Invoice: ${url(`/p/${invoice.slug}`)}`,
    `Your page: ${url(`/c/${booking.slug}`)}`,
    '',
    signOff(),
  ]
  return {
    subject: subject('Your invoice from Piper DJing', booking.sample),
    text: compact(lines),
  }
}

function greeting(booking: LetterBooking): string {
  return `Hello ${booking.partnerOne} and ${booking.partnerTwo},`
}

function sampleLine(booking: LetterBooking): string {
  return booking.sample ? 'This is a TEST booking. It is not a real date.' : ''
}

function stagLine(booking: LetterBooking): string {
  if (!booking.withStag) return ''
  if (booking.stagReleased) return 'The stag date is released.'
  if (!booking.stagDate) return 'Stag and doe: date still to set.'
  return `Stag and doe: ${longDate(booking.stagDate)}`
}

function holdLine(booking: LetterBooking): string {
  if (
    booking.status !== 'hold' ||
    !booking.holdStartedOn ||
    !booking.holdLastDay
  )
    return ''
  return `Hold: ${longDate(booking.holdStartedOn)} through ${longDate(booking.holdLastDay)}`
}

function venueLine(labelText: string, name: string): string {
  const trimmed = name.trim()
  return trimmed ? `${labelText}: ${trimmed}` : ''
}

function moneyBlock(
  total: number,
  deposit: number,
  received: number,
  balance: number,
): string {
  return [
    `Total: ${cad(total)}`,
    `Deposit: ${cad(deposit)}`,
    `Received: ${cad(received)}`,
    `Balance: ${cad(balance)}`,
  ].join('\n')
}

function label(status: string): string {
  return STATUS_LABEL[status] ?? status
}

function subject(title: string, sample: boolean): string {
  return sample ? `TEST · ${title}` : title
}

function signOff(): string {
  return `Piper DJing\n${PUBLIC_EMAIL}`
}

function compact(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

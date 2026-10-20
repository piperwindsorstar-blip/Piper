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
  discountCents?: number
  slug: string
  holdStartedOn: string | null
  holdLastDay: string | null
  stagReleased: boolean
  invoice: LetterInvoice | null
}

export type LetterAttachment = {
  filename: string
  /** Raw file contents. Base64 for binary, plain text for CSV and the like. */
  content: string
  contentType: string
}

export type Letter = {
  subject: string
  text: string
  /** Optional rich card. Falls back to the plain text when absent. */
  html?: string
  attachments?: LetterAttachment[]
  /**
   * The From name for this letter. The address never changes. Left out, the
   * letter goes as the site's usual sender.
   */
  fromName?: string
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
      booking.discountCents ?? 0,
    ),
    '',
    `Your page: ${url(`/c/${booking.slug}`)}`,
    'Your planning form is on that page.',
    booking.invoice ? `Invoice: ${url(`/p/${booking.invoice.slug}`)}` : '',
    '',
    signOff(),
  ]
  return {
    subject: subject('Your date with DJ Piper P', booking.sample),
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
      booking.discountCents ?? 0,
    ),
    '',
    `Invoice: ${url(`/p/${invoice.slug}`)}`,
    `Your page: ${url(`/c/${booking.slug}`)}`,
    '',
    signOff(),
  ]
  return {
    subject: subject('Your invoice from DJ Piper P', booking.sample),
    text: compact(lines),
  }
}

export type LetterPayment = {
  id: number
  cents: number
  /** Card HST paid on top of this payment; 0 for e-transfer and cash. */
  hstCents: number
  paidOn: string
  method: string
}

const METHOD_LABEL: Record<string, string> = {
  card: 'card',
  cash: 'cash',
  'e-transfer': 'e-transfer',
}

function paymentLine(payment: LetterPayment): string {
  const when = payment.paidOn ? `${longDate(payment.paidOn)}: ` : ''
  const how = METHOD_LABEL[payment.method] ? ` by ${METHOD_LABEL[payment.method]}` : ''
  if (payment.cents < 0) return `${when}${cad(-payment.cents)} refunded`
  if (payment.hstCents > 0) {
    return `${when}${cad(payment.cents)}${how} + ${cad(payment.hstCents)} HST (13% on this card payment) = ${cad(payment.cents + payment.hstCents)} charged`
  }
  return `${when}${cad(payment.cents)}${how}`
}

/**
 * The receipt for one payment: what was paid, the card HST on it (HST is on
 * top and never counts toward the balance), every payment so far, and what
 * is left.
 */
export function paymentLetter(
  booking: LetterBooking,
  payments: LetterPayment[],
  paymentId: number,
  url: (path: string) => string,
): Letter {
  const invoice = booking.invoice
  if (!invoice) throw new Error('This booking has no invoice.')
  const paid = payments.find((payment) => payment.id === paymentId)
  if (!paid) throw new Error('That payment is not on the book.')
  const hstTotal = payments.reduce(
    (sum, payment) => sum + (payment.cents > 0 ? payment.hstCents : 0),
    0,
  )
  const lines = [
    greeting(booking),
    '',
    sampleLine(booking),
    'Thank you. Your payment is in.',
    '',
    `This payment: ${paymentLine(paid)}`,
    paid.hstCents > 0
      ? 'The HST is on top of your payment and does not count toward your balance.'
      : '',
    booking.status === 'booked' ? `Your date is booked: ${longDate(booking.eventDate)}` : `Date: ${longDate(booking.eventDate)}`,
    `Package: ${booking.packageName}`,
    '',
    'Payments so far:',
    ...payments.map((payment) => `- ${paymentLine(payment)}`),
    '',
    `Total: ${cad(invoice.totalCents)}`,
    `Paid so far: ${cad(invoice.receivedCents)}`,
    hstTotal > 0 ? `Card HST paid (on top): ${cad(hstTotal)}` : '',
    `Remaining: ${cad(invoice.balanceCents)}`,
    '',
    `Invoice: ${url(`/p/${invoice.slug}`)}`,
    `Your page: ${url(`/c/${booking.slug}`)}`,
    '',
    signOff(),
  ]
  return {
    subject: subject('Payment received · DJ Piper P', booking.sample),
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
  discount = 0,
): string {
  return [
    ...(discount > 0 ? [`Discount: ${cad(discount)}`] : []),
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
  return `DJ Piper P\n${PUBLIC_EMAIL}`
}

function compact(lines: string[]): string {
  return lines
    .join('\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

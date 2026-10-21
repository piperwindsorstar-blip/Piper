import { dollars, hstCents, HST_RATE_PERCENT } from '../crm/card-pay.ts'
import { PIPER_RSVP_CENTS, STANDALONE_RSVP_CENTS, coupleSlug } from './model.ts'
import type { PriceKind } from './model.ts'

/**
 * Buying an RSVP page by card. Pure rules, so the page, the checkout and the
 * webhook agree: free for a couple whose Piper booking has its deposit in,
 * $40 for anyone else, plus 13% HST on the card payment. The price is only
 * ever worked out on the server.
 */

export type RsvpPurchase = {
  partnerOne: string
  partnerTwo: string
  email: string
  eventDate: string
  /** Optional: their DJ Piper P booking email or invoice code. */
  bookingRef: string
}

export type RsvpQuote = {
  kind: PriceKind
  label: string
  baseCents: number
  hstCents: number
  chargeCents: number
}

/** A booking as the price check sees it. */
export type PriceBooking = {
  email: string
  invoiceSlug: string
  sample: boolean
  status: string
  depositCents: number
  receivedCents: number
}

function clean(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

/** Checks and tidies what the couple typed; an error names the first problem. */
export function parsePurchase(
  input: Record<string, unknown>,
): { ok: true; purchase: RsvpPurchase } | { ok: false; error: string } {
  const purchase: RsvpPurchase = {
    partnerOne: clean(input.partnerOne, 40),
    partnerTwo: clean(input.partnerTwo, 40),
    email: clean(input.email, 120).toLowerCase(),
    eventDate: clean(input.eventDate, 10),
    bookingRef: clean(input.bookingRef, 120),
  }
  if (!purchase.partnerOne || !purchase.partnerTwo) {
    return { ok: false, error: 'Enter both names.' }
  }
  if (!EMAIL.test(purchase.email)) {
    return { ok: false, error: 'Enter your email.' }
  }
  if (!/^\d{4}-\d{2}-\d{2}$/.test(purchase.eventDate)) {
    return { ok: false, error: 'Choose the wedding date.' }
  }
  return { ok: true, purchase }
}

/** The invoice code from "abc123", "/p/abc123" or a full invoice link. */
export function invoiceCodeFrom(ref: string): string {
  const trimmed = ref.trim()
  const match = trimmed.match(/\/p\/([A-Za-z0-9_-]+)/)
  return (match?.[1] ?? trimmed).toLowerCase()
}

/** A booking with its deposit received, and not cancelled or released. */
function depositIn(booking: PriceBooking): boolean {
  if (booking.sample) return false
  if (booking.status === 'cancelled' || booking.status === 'released') {
    return false
  }
  if (booking.status === 'booked') return true
  return booking.depositCents > 0 && booking.receivedCents >= booking.depositCents
}

/**
 * True when the couple's email, or the booking email or invoice code they
 * gave, belongs to a Piper booking whose deposit is in.
 */
export function matchesPaidBooking(
  purchase: Pick<RsvpPurchase, 'email' | 'bookingRef'>,
  bookings: PriceBooking[],
): boolean {
  const emails = new Set(
    [purchase.email, purchase.bookingRef]
      .map((value) => value.trim().toLowerCase())
      .filter((value) => EMAIL.test(value)),
  )
  const code =
    purchase.bookingRef && !EMAIL.test(purchase.bookingRef.trim())
      ? invoiceCodeFrom(purchase.bookingRef)
      : ''
  return bookings.some(
    (booking) =>
      depositIn(booking) &&
      (emails.has(booking.email.trim().toLowerCase()) ||
        (code.length >= 4 && booking.invoiceSlug.toLowerCase() === code)),
  )
}

export function rsvpQuote(matched: boolean): RsvpQuote {
  const base = matched ? PIPER_RSVP_CENTS : STANDALONE_RSVP_CENTS
  const hst = hstCents(base)
  return {
    kind: matched ? 'piper' : 'standalone',
    label: matched
      ? 'Wedding RSVP page · included with your Piper booking'
      : 'Wedding RSVP page',
    baseCents: base,
    hstCents: hst,
    chargeCents: base + hst,
  }
}

export function rsvpHstLabel(baseCents: number): string {
  return `HST ${HST_RATE_PERCENT}% on this card payment of ${dollars(baseCents)}`
}

/** "$40.00 + $5.20 HST = $45.20" for receipts. */
export function paidLabel(quote: { baseCents: number; hstCents: number }): string {
  if (quote.baseCents + quote.hstCents === 0) return 'Free with your Piper booking'
  return `${dollars(quote.baseCents)} + ${dollars(quote.hstCents)} HST = ${dollars(quote.baseCents + quote.hstCents)}`
}

/**
 * The POST /v1/checkout/sessions form for an RSVP page: CAD only, no
 * adaptive pricing, and metadata the webhook builds the site from.
 */
export function rsvpCheckoutForm(input: {
  quote: RsvpQuote
  purchase: RsvpPurchase
  successUrl: string
  cancelUrl: string
}): URLSearchParams {
  const form = new URLSearchParams()
  form.set('mode', 'payment')
  form.set('currency', 'cad')
  form.set('adaptive_pricing[enabled]', 'false')
  form.set('success_url', input.successUrl)
  form.set('cancel_url', input.cancelUrl)
  form.set('payment_method_types[0]', 'card')
  form.set('customer_email', input.purchase.email)
  const lines: [string, number][] = [[input.quote.label, input.quote.baseCents]]
  if (input.quote.hstCents > 0) {
    lines.push([rsvpHstLabel(input.quote.baseCents), input.quote.hstCents])
  }
  lines.forEach(([name, cents], index) => {
    form.set(`line_items[${index}][quantity]`, '1')
    form.set(`line_items[${index}][price_data][currency]`, 'cad')
    form.set(`line_items[${index}][price_data][unit_amount]`, String(cents))
    form.set(`line_items[${index}][price_data][product_data][name]`, name)
  })
  const metadata: Record<string, string> = {
    purpose: 'rsvp',
    priceKind: input.quote.kind,
    baseCents: String(input.quote.baseCents),
    hstCents: String(input.quote.hstCents),
    partnerOne: input.purchase.partnerOne,
    partnerTwo: input.purchase.partnerTwo,
    email: input.purchase.email,
    eventDate: input.purchase.eventDate,
  }
  for (const [key, value] of Object.entries(metadata)) {
    form.set(`metadata[${key}]`, value)
    form.set(`payment_intent_data[metadata][${key}]`, value)
  }
  form.set(
    'payment_intent_data[description]',
    `RSVP page · ${input.purchase.partnerOne} & ${input.purchase.partnerTwo}`.slice(0, 500),
  )
  return form
}

/** Reads the purchase back from a paid session's metadata. */
export function purchaseFromMetadata(meta: Record<string, string>): {
  purchase: RsvpPurchase
  kind: PriceKind
  baseCents: number
  hstCents: number
} | null {
  if (meta.purpose !== 'rsvp') return null
  const parsed = parsePurchase({ ...meta, bookingRef: '' })
  if (!parsed.ok) return null
  const baseCents = Number(meta.baseCents)
  const hst = Number(meta.hstCents)
  if (!Number.isInteger(baseCents) || baseCents <= 0) return null
  if (!Number.isInteger(hst) || hst < 0) return null
  return {
    purchase: parsed.purchase,
    kind: meta.priceKind === 'piper' ? 'piper' : 'standalone',
    baseCents,
    hstCents: hst,
  }
}

/**
 * Where a paid purchase goes, never making a second site: the site already
 * on this email is paid ("attached"); a site already holding these names
 * under another email is left for the owner ("needs-check"); otherwise a new
 * site at the names' slug ("created").
 */
export function placePurchase(
  sites: { slug: string; email: string; sample?: boolean }[],
  purchase: Pick<RsvpPurchase, 'partnerOne' | 'partnerTwo' | 'email'>,
): { outcome: 'created' | 'attached' | 'needs-check'; slug: string } {
  const email = purchase.email.trim().toLowerCase()
  const mine = sites.find(
    (site) => !site.sample && site.email.trim().toLowerCase() === email,
  )
  if (mine) return { outcome: 'attached', slug: mine.slug }
  const slug = coupleSlug(purchase.partnerOne, purchase.partnerTwo)
  if (sites.some((site) => site.slug === slug)) {
    return { outcome: 'needs-check', slug }
  }
  return { outcome: 'created', slug }
}

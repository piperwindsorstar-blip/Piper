/**
 * Paying an invoice by card through Stripe Checkout. Pure rules, so the
 * invoice page, the checkout and the webhook all charge and record exactly
 * the same amounts.
 *
 * Card HST (13%) is charged once, on the FULL booking total, and always with
 * the balance: never on the deposit. Ceremony only is paid in full, so its
 * one card payment carries the HST. E-transfer and cash never carry HST.
 */

export const HST_RATE_PERCENT = 13

export type CardKind = 'deposit' | 'balance' | 'full'

export type CardQuote = {
  kind: CardKind
  /** What the line on the invoice is called. */
  label: string
  /** The booking money this payment covers; recorded on the desk. */
  baseCents: number
  /** Card HST, on the full booking total; 0 for a deposit. */
  hstCents: number
  /** What the card is charged: base + HST. */
  chargeCents: number
  /** The total the HST is worked out on, for the "13% of $x" line. */
  hstOnCents: number
}

/** 13% of a total, to the nearest cent (a half cent rounds up). */
export function hstCents(totalCents: number): number {
  return Math.round((totalCents * HST_RATE_PERCENT) / 100)
}

export type QuoteInvoice = {
  status: string
  totalCents: number
  depositCents: number
  receivedCents: number
  balanceCents: number
}

export type QuoteBooking = {
  packageId: string
  packageName: string
}

/**
 * What a card payment on this invoice is right now, or null when there is
 * nothing to pay by card: a void or fully paid invoice, or a Custom booking whose
 * price the owner has not set (a price is never guessed).
 */
export function cardQuote(
  invoice: QuoteInvoice,
  booking: QuoteBooking,
): CardQuote | null {
  if (invoice.status === 'void') return null
  if (!Number.isInteger(invoice.totalCents) || invoice.totalCents <= 0) {
    return null
  }
  const balance = Math.max(0, invoice.totalCents - invoice.receivedCents)
  if (balance <= 0) return null
  const hst = hstCents(invoice.totalCents)
  const name = booking.packageName || 'Booking'
  // Ceremony only is paid in full, in one payment, which carries the HST.
  if (
    booking.packageId === 'ceremony' ||
    invoice.depositCents >= invoice.totalCents
  ) {
    return {
      kind: 'full',
      label: `${name}, paid in full`,
      baseCents: balance,
      hstCents: hst,
      chargeCents: balance + hst,
      hstOnCents: invoice.totalCents,
    }
  }
  if (invoice.receivedCents < invoice.depositCents) {
    const due = invoice.depositCents - invoice.receivedCents
    return {
      kind: 'deposit',
      label: `Deposit · ${name}`,
      baseCents: due,
      hstCents: 0,
      chargeCents: due,
      hstOnCents: 0,
    }
  }
  return {
    kind: 'balance',
    label: `Balance · ${name}`,
    baseCents: balance,
    hstCents: hst,
    chargeCents: balance + hst,
    hstOnCents: invoice.totalCents,
  }
}

/**
 * The form body for POST /v1/checkout/sessions: one line for the booking
 * money and, when there is HST, one line for it, in CAD. The metadata is
 * what the webhook records, so nothing is worked out twice.
 */
export function checkoutForm(input: {
  quote: CardQuote
  bookingId: number
  invoiceSlug: string
  email: string
  successUrl: string
  cancelUrl: string
  couple: string
}): URLSearchParams {
  const form = new URLSearchParams()
  form.set('mode', 'payment')
  form.set('success_url', input.successUrl)
  form.set('cancel_url', input.cancelUrl)
  form.set('client_reference_id', input.invoiceSlug)
  form.set('payment_method_types[0]', 'card')
  if (input.email) form.set('customer_email', input.email)
  const lines: [string, number][] = [[input.quote.label, input.quote.baseCents]]
  if (input.quote.hstCents > 0) {
    lines.push([
      `HST ${HST_RATE_PERCENT}% on the ${dollars(input.quote.hstOnCents)} booking total`,
      input.quote.hstCents,
    ])
  }
  lines.forEach(([name, cents], index) => {
    form.set(`line_items[${index}][quantity]`, '1')
    form.set(`line_items[${index}][price_data][currency]`, 'cad')
    form.set(`line_items[${index}][price_data][unit_amount]`, String(cents))
    form.set(`line_items[${index}][price_data][product_data][name]`, name)
  })
  const metadata: Record<string, string> = {
    bookingId: String(input.bookingId),
    invoiceSlug: input.invoiceSlug,
    kind: input.quote.kind,
    baseCents: String(input.quote.baseCents),
    hstCents: String(input.quote.hstCents),
    couple: input.couple.slice(0, 200),
  }
  for (const [key, value] of Object.entries(metadata)) {
    form.set(`metadata[${key}]`, value)
    form.set(`payment_intent_data[metadata][${key}]`, value)
  }
  form.set(
    'payment_intent_data[description]',
    `${input.quote.label} · ${input.couple}`.slice(0, 500),
  )
  return form
}

export function dollars(cents: number): string {
  return `$${(cents / 100).toLocaleString('en-CA', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`
}

const encoder = new TextEncoder()

function hex(buffer: ArrayBuffer): string {
  return [...new Uint8Array(buffer)]
    .map((byte) => byte.toString(16).padStart(2, '0'))
    .join('')
}

function sameText(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let index = 0; index < a.length; index += 1) {
    diff |= a.charCodeAt(index) ^ b.charCodeAt(index)
  }
  return diff === 0
}

/** Stripe's v1 signature: HMAC-SHA256 of "timestamp.payload" with the secret. */
export async function stripeSignature(
  payload: string,
  timestamp: number,
  secret: string,
): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  return hex(
    await crypto.subtle.sign('HMAC', key, encoder.encode(`${timestamp}.${payload}`)),
  )
}

/**
 * Checks the Stripe-Signature header against the raw body. Refuses a missing
 * or wrong signature and anything older than five minutes (a replay).
 */
export async function verifyStripeSignature(
  payload: string,
  header: string,
  secret: string,
  now = Date.now(),
  toleranceSeconds = 300,
): Promise<boolean> {
  if (!header || !secret) return false
  const parts = header.split(',').map((part) => part.trim().split('='))
  const timestamp = Number(parts.find(([key]) => key === 't')?.[1])
  const signatures = parts
    .filter(([key]) => key === 'v1')
    .map(([, value]) => value ?? '')
  if (!Number.isFinite(timestamp) || signatures.length === 0) return false
  if (Math.abs(now / 1000 - timestamp) > toleranceSeconds) return false
  const expected = await stripeSignature(payload, timestamp, secret)
  return signatures.some((signature) => sameText(signature, expected))
}

/** The note on the desk's payment: "Stripe pi_123 (test) · deposit · …". */
export function stripeNote(input: {
  paymentId: string
  live: boolean
  kind: CardKind
  hstCents: number
}): string {
  const parts = [
    `Stripe ${input.paymentId}${input.live ? '' : ' (test)'}`,
    input.kind === 'full' ? 'paid in full' : input.kind,
  ]
  if (input.hstCents > 0) {
    parts.push(`card HST ${dollars(input.hstCents)} collected`)
  }
  return parts.join(' · ')
}

/** Reads a desk payment's note back: the Stripe payment, if it is one. */
export function stripeFromNote(
  note: string,
): { paymentId: string; live: boolean; dashboardUrl: string } | null {
  const match = note.match(/\bStripe ((?:pi|ch|py)_[A-Za-z0-9]+)( \(test\))?/)
  if (!match?.[1]) return null
  const live = !match[2]
  return {
    paymentId: match[1],
    live,
    dashboardUrl: `https://dashboard.stripe.com/${live ? '' : 'test/'}payments/${match[1]}`,
  }
}

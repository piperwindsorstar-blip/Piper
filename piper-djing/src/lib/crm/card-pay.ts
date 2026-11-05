/**
 * Paying an invoice by card through Stripe Checkout. Pure rules, so the
 * invoice page, the checkout and the webhook all charge and record exactly
 * the same amounts.
 *
 * Card HST (13%) is charged only on the amount paid by card in that one
 * payment, and never on a deposit. HST is added on top: it is not booking
 * money and never lowers the remaining balance. E-transfer and cash never
 * carry HST.
 *
 * HST can be switched off for invoices in Desk → Settings. The card fee (3%)
 * is on every card payment, the deposit included; it is also on top and
 * never lowers the balance.
 */

export const HST_RATE_PERCENT = 13

/** The card processing fee on invoice payments by card. */
export const CARD_FEE_PERCENT = 3

/** Whether invoice card payments carry HST, and the card fee percent. */
export type CardRules = { hst: boolean; feePercent: number }

/** How card payments worked before the HST switch and the card fee. */
const LEGACY_RULES: CardRules = { hst: true, feePercent: 0 }

/** The smallest card payment toward the balance (unless less is left). */
export const MIN_CARD_PAYMENT_CENTS = 5000

export type CardKind = 'deposit' | 'balance' | 'full'

export type CardQuote = {
  kind: CardKind
  /** What the line on the invoice is called. */
  label: string
  /** The booking money this payment covers; recorded on the desk. */
  baseCents: number
  /** Card HST: 13% of baseCents, or 0 for a deposit or with HST off. */
  hstCents: number
  /** The card fee: CARD_FEE_PERCENT of baseCents. */
  feeCents: number
  /** What the card is charged: base + HST + fee. */
  chargeCents: number
  /** The rules this quote was made with, kept for a chosen amount. */
  rules: CardRules
  /** The deposit still due when this quote was made; 0 once it is paid. */
  depositDueCents: number
  /** The package or event name, for the line label. */
  itemName: string
  /** True when the couple may choose how much to pay (the balance). */
  adjustable: boolean
  /** The allowed range for baseCents. */
  minCents: number
  maxCents: number
}

/** 13% of an amount, to the nearest cent (a half cent rounds up). */
export function hstCents(amountCents: number): number {
  return Math.round((amountCents * HST_RATE_PERCENT) / 100)
}

/** The card fee on an amount, to the nearest cent. */
export function feeCents(amountCents: number, percent: number): number {
  if (!(percent > 0)) return 0
  return Math.round((amountCents * percent) / 100)
}

/**
 * Base, HST and fee for one card payment under these rules. HST is only on
 * the part of the payment past the deposit (`hstBase`).
 */
function priced(base: number, hstBase: number, rules: CardRules) {
  const hst = hstBase > 0 && rules.hst ? hstCents(hstBase) : 0
  const fee = feeCents(base, rules.feePercent)
  return { baseCents: base, hstCents: hst, feeCents: fee, chargeCents: base + hst + fee, rules }
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

function fixed(
  kind: CardKind,
  label: string,
  base: number,
  rules: CardRules,
  itemName: string,
): CardQuote {
  return {
    kind,
    label,
    ...priced(base, base, rules),
    depositDueCents: 0,
    itemName,
    adjustable: false,
    minCents: base,
    maxCents: base,
  }
}

/**
 * What a card payment on this invoice is right now, or null when there is
 * nothing to pay by card: a void or fully paid invoice, or a Custom booking
 * whose price the owner has not set (a price is never guessed). Payments
 * by e-transfer or cash already lower receivedCents, so they count here.
 */
export function cardQuote(
  invoice: QuoteInvoice,
  booking: QuoteBooking,
  rules: CardRules = LEGACY_RULES,
): CardQuote | null {
  if (invoice.status === 'void') return null
  if (!Number.isInteger(invoice.totalCents) || invoice.totalCents <= 0) {
    return null
  }
  const remaining = Math.max(0, invoice.totalCents - invoice.receivedCents)
  if (remaining <= 0) return null
  const name = booking.packageName || 'Booking'
  // Ceremony only is paid in full, in one payment, with HST on that payment.
  if (
    booking.packageId === 'ceremony' ||
    invoice.depositCents >= invoice.totalCents
  ) {
    return fixed('full', `${name}, paid in full`, remaining, rules, name)
  }
  // The deposit is suggested; the client may pay any amount from the
  // smallest card payment up to everything remaining.
  if (invoice.receivedCents < invoice.depositCents) {
    const due = Math.min(remaining, invoice.depositCents - invoice.receivedCents)
    return {
      kind: 'deposit',
      label: `Deposit · ${name}`,
      ...priced(due, 0, rules),
      depositDueCents: due,
      itemName: name,
      adjustable: true,
      minCents: Math.min(MIN_CARD_PAYMENT_CENTS, remaining),
      maxCents: remaining,
    }
  }
  return {
    kind: 'balance',
    label: `Balance · ${name}`,
    ...priced(remaining, remaining, rules),
    depositDueCents: 0,
    itemName: name,
    adjustable: true,
    minCents: Math.min(MIN_CARD_PAYMENT_CENTS, remaining),
    maxCents: remaining,
  }
}

/**
 * The quote for the amount the couple chose. Only a balance payment can be
 * changed; anything outside min..max is refused with a reason.
 */
export function cardPayment(
  quote: CardQuote,
  amountCents?: number,
): { ok: true; quote: CardQuote } | { ok: false; error: string } {
  if (amountCents === undefined || amountCents === quote.baseCents) {
    return { ok: true, quote }
  }
  if (!quote.adjustable) {
    return { ok: false, error: `This payment is ${dollars(quote.baseCents)}.` }
  }
  if (!Number.isInteger(amountCents) || amountCents < quote.minCents) {
    return {
      ok: false,
      error: `The smallest card payment is ${dollars(quote.minCents)}.`,
    }
  }
  if (amountCents > quote.maxCents) {
    return {
      ok: false,
      error: `The most you can pay is the ${dollars(quote.maxCents)} remaining.`,
    }
  }
  // The chosen amount keeps the quote's rules; no HST on the deposit part.
  const deposit = quote.depositDueCents
  return {
    ok: true,
    quote: {
      ...quote,
      label: chosenLabel(quote, amountCents),
      ...priced(amountCents, Math.max(0, amountCents - deposit), quote.rules),
    },
  }
}

function chosenLabel(quote: CardQuote, amount: number): string {
  const name = quote.itemName
  if (amount >= quote.maxCents) return quote.kind === 'balance' ? `Balance · ${name}` : `${name}, paid in full`
  if (quote.kind !== 'deposit') return `Part of the balance · ${name}`
  if (amount < quote.depositDueCents) return `Part of the deposit · ${name}`
  if (amount === quote.depositDueCents) return `Deposit · ${name}`
  return `Deposit and part of the balance · ${name}`
}

/** The invoice's card fee line for one card payment. */
export function feeLabel(baseCents: number, percent = CARD_FEE_PERCENT): string {
  return `Card fee ${percent}% on this card payment of ${dollars(baseCents)}`
}

/** The invoice's HST line for one card payment. */
export function hstLabel(baseCents: number): string {
  return `HST ${HST_RATE_PERCENT}% on this card payment of ${dollars(baseCents)}`
}

/** "1,155.50" or "$1,155.50" typed by a couple, in cents; NaN when not money. */
export function parseAmount(text: string): number {
  const clean = text.replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(clean)) return Number.NaN
  const [whole, part = ''] = clean.split('.')
  return Number(whole) * 100 + Number(part.padEnd(2, '0'))
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
  // Always CAD: no converted price for cards from other countries.
  form.set('currency', 'cad')
  form.set('adaptive_pricing[enabled]', 'false')
  form.set('success_url', input.successUrl)
  form.set('cancel_url', input.cancelUrl)
  form.set('client_reference_id', input.invoiceSlug)
  form.set('payment_method_types[0]', 'card')
  if (input.email) form.set('customer_email', input.email)
  const lines: [string, number][] = [[input.quote.label, input.quote.baseCents]]
  if (input.quote.hstCents > 0) {
    lines.push([hstLabel(input.quote.baseCents), input.quote.hstCents])
  }
  if (input.quote.feeCents > 0) {
    lines.push([feeLabel(input.quote.baseCents), input.quote.feeCents])
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
    feeCents: String(input.quote.feeCents),
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

/**
 * The note on the desk's payment: "Stripe pi_123 (test) · balance". The HST
 * has its own field on the payment.
 */
export function stripeNote(input: {
  paymentId: string
  live: boolean
  kind: CardKind
}): string {
  return [
    `Stripe ${input.paymentId}${input.live ? '' : ' (test)'}`,
    input.kind === 'full' ? 'paid in full' : input.kind,
  ].join(' · ')
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

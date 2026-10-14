import { torontoToday } from '../piper/rules.ts'
import { cardPayment, cardQuote, checkoutForm } from './card-pay.ts'
import type { CardQuote } from './card-pay.ts'
import { processStripeWebhook } from './stripe-webhook.ts'
import {
  matchesPaidBooking,
  parsePurchase,
  rsvpCheckoutForm,
  rsvpQuote,
} from '../rsvp/purchase.ts'
import type { RsvpQuote } from '../rsvp/purchase.ts'
import { fulfilRsvpPurchase, priceBookings } from '../rsvp/purchase.server.ts'
import { emailOwner, emailPayment } from './mail.server.ts'
import { publicUrl } from './safe-origin.ts'
import {
  addPayment,
  cardContextBySlug,
  claimStripeSession,
  finishStripeSession,
  readSiteSetting,
  releaseStripeSession,
  writeSiteSetting,
} from './store.server.ts'

/**
 * Card payments through Stripe Checkout. The secret key and webhook secret
 * live only in the Worker (STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET); the
 * browser only ever gets Stripe's hosted checkout link.
 */

const SETTING = 'card_payments'

function secrets(): { key: string; webhook: string } | null {
  const key = process.env.STRIPE_SECRET_KEY?.trim() ?? ''
  const webhook = process.env.STRIPE_WEBHOOK_SECRET?.trim() ?? ''
  if (!key || !webhook) return null
  return { key, webhook }
}

export type CardStatus = {
  configured: boolean
  enabled: boolean
  live: boolean
}

/** Off by default; only ever on once both secrets are set. */
export async function cardStatus(): Promise<CardStatus> {
  const keys = secrets()
  let wanted = false
  try {
    wanted = (await readSiteSetting(SETTING)) === 'on'
  } catch {
    wanted = false
  }
  return {
    configured: keys !== null,
    enabled: keys !== null && wanted,
    live: keys?.key.startsWith('sk_live_') ?? false,
  }
}

export async function setCardPayments(on: boolean): Promise<CardStatus> {
  await writeSiteSetting(SETTING, on ? 'on' : 'off')
  return cardStatus()
}

/** The card amounts the invoice page shows, or null to hide the button. */
export async function cardQuoteForInvoice(
  slug: string,
): Promise<CardQuote | null> {
  try {
    const status = await cardStatus()
    if (!status.enabled) return null
    const context = await cardContextBySlug(slug)
    if (!context) return null
    return cardQuote(context.invoice, context)
  } catch {
    return null
  }
}

/**
 * Creates a Stripe Checkout session for exactly what is due now, worked out
 * here on the server from the invoice, never from anything the browser sent.
 */
export async function startCheckout(
  slug: string,
  amountCents?: number,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const status = await cardStatus()
  const keys = secrets()
  if (!status.enabled || !keys) {
    return { ok: false, error: 'Card payment is not available right now.' }
  }
  const context = await cardContextBySlug(slug)
  if (!context) return { ok: false, error: 'That invoice was not found.' }
  const due = cardQuote(context.invoice, context)
  if (!due) return { ok: false, error: 'Nothing is due on this invoice.' }
  const chosen = cardPayment(due, amountCents)
  if (!chosen.ok) return chosen
  const quote = chosen.quote
  const form = checkoutForm({
    quote,
    bookingId: context.bookingId,
    invoiceSlug: context.invoiceSlug,
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(context.email.trim())
      ? context.email.trim()
      : '',
    successUrl: `${publicUrl(`/p/${context.invoiceSlug}`)}?paid=1`,
    cancelUrl: publicUrl(`/p/${context.invoiceSlug}`),
    couple: context.couple,
  })
  return createSession(keys.key, form)
}

/** POSTs a Checkout Session; the browser only ever gets Stripe's link. */
async function createSession(
  key: string,
  form: URLSearchParams,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${key}`,
        'content-type': 'application/x-www-form-urlencoded',
      },
      body: form.toString(),
    })
    const body = (await response.json().catch(() => null)) as {
      url?: string
      error?: { message?: string }
    } | null
    if (!response.ok || !body?.url) {
      console.warn('[stripe] checkout refused:', body?.error?.message)
      return {
        ok: false,
        error: 'Card payment could not start. Please try again, or pay by e-transfer.',
      }
    }
    return { ok: true, url: body.url }
  } catch {
    return {
      ok: false,
      error: 'Card payment could not start. Please try again, or pay by e-transfer.',
    }
  }
}

/**
 * POST /api/stripe/webhook, wired to the real book and mail. The rules live
 * in stripe-webhook.ts so they can be tested without a database.
 */
export async function handleStripeWebhook(request: Request): Promise<Response> {
  const keys = secrets()
  if (!keys) return new Response('Not configured', { status: 503 })
  return processStripeWebhook(request, {
    webhookSecret: keys.webhook,
    today: torontoToday,
    claim: claimStripeSession,
    finish: finishStripeSession,
    release: releaseStripeSession,
    record: async (input) => {
      const result = await addPayment(
        input.bookingId,
        input.cents,
        input.note,
        input.paidOn,
        'card',
        input.hstCents,
      )
      return {
        paymentId: result.paymentId,
        receivedCents: result.view.invoice?.receivedCents ?? 0,
        totalCents: result.view.invoice?.totalCents ?? 0,
      }
    },
    emailOwner: async (letter) => {
      await emailOwner(letter)
    },
    emailReceipt: async (bookingId, paymentId) => {
      await emailPayment(bookingId, paymentId)
    },
    rsvpPurchase: fulfilRsvpPurchase,
  })
}

// --- RSVP pages bought by card ----------------------------------------------

/**
 * The RSVP page price for what the couple typed, worked out here only:
 * $20 with a Piper booking whose deposit is in, else $30, plus card HST.
 * Null when card payments are off (the page shows "Contact us").
 */
export async function quoteRsvpPurchase(
  input: Record<string, unknown>,
): Promise<
  | { ok: true; quote: RsvpQuote }
  | { ok: false; error: string; off?: boolean }
> {
  const status = await cardStatus()
  if (!status.enabled) {
    return { ok: false, off: true, error: 'Card payment is not available right now.' }
  }
  const parsed = parsePurchase(input)
  if (!parsed.ok) return parsed
  const matched = matchesPaidBooking(parsed.purchase, await priceBookings())
  return { ok: true, quote: rsvpQuote(matched) }
}

export async function startRsvpCheckout(
  input: Record<string, unknown>,
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const keys = secrets()
  const status = await cardStatus()
  if (!keys || !status.enabled) {
    return { ok: false, error: 'Card payment is not available right now.' }
  }
  const parsed = parsePurchase(input)
  if (!parsed.ok) return parsed
  const matched = matchesPaidBooking(parsed.purchase, await priceBookings())
  const form = rsvpCheckoutForm({
    quote: rsvpQuote(matched),
    purchase: parsed.purchase,
    // Stripe fills in the session id, which signs them straight in.
    successUrl: `${publicUrl('/rsvp')}?session={CHECKOUT_SESSION_ID}`,
    cancelUrl: publicUrl('/rsvp'),
  })
  return createSession(keys.key, form)
}

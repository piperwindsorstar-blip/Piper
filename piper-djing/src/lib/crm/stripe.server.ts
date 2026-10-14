import { torontoToday } from '../piper/rules.ts'
import { cardQuote, checkoutForm, stripeNote, verifyStripeSignature } from './card-pay.ts'
import type { CardKind, CardQuote } from './card-pay.ts'
import { emailBooking, emailOwner } from './mail.server.ts'
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
): Promise<{ ok: true; url: string } | { ok: false; error: string }> {
  const status = await cardStatus()
  const keys = secrets()
  if (!status.enabled || !keys) {
    return { ok: false, error: 'Card payment is not available right now.' }
  }
  const context = await cardContextBySlug(slug)
  if (!context) return { ok: false, error: 'That invoice was not found.' }
  const quote = cardQuote(context.invoice, context)
  if (!quote) return { ok: false, error: 'Nothing is due on this invoice.' }
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
  try {
    const response = await fetch('https://api.stripe.com/v1/checkout/sessions', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${keys.key}`,
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

type CheckoutSession = {
  id?: string
  payment_status?: string
  amount_total?: number
  currency?: string
  livemode?: boolean
  payment_intent?: string | { id?: string } | null
  metadata?: Record<string, string>
}

function text(value: unknown): string {
  return typeof value === 'string' ? value : ''
}

/**
 * POST /api/stripe/webhook. Checks Stripe's signature, then records a paid
 * Checkout session on the desk once: the booking money as a card payment
 * dated today in Toronto, the HST in the note. A paid deposit books the date
 * exactly like a deposit recorded by hand; nothing here ever unbooks one.
 */
export async function handleStripeWebhook(request: Request): Promise<Response> {
  const keys = secrets()
  if (!keys) return new Response('Not configured', { status: 503 })
  const payload = await request.text()
  const signed = await verifyStripeSignature(
    payload,
    request.headers.get('stripe-signature') ?? '',
    keys.webhook,
  )
  if (!signed) return new Response('Bad signature', { status: 400 })

  let event: { type?: string; data?: { object?: CheckoutSession } }
  try {
    event = JSON.parse(payload) as typeof event
  } catch {
    return new Response('Bad body', { status: 400 })
  }
  if (
    event.type !== 'checkout.session.completed' &&
    event.type !== 'checkout.session.async_payment_succeeded'
  ) {
    return Response.json({ received: true, ignored: event.type ?? '' })
  }
  const session = event.data?.object ?? {}
  if (session.payment_status !== 'paid') {
    return Response.json({ received: true, waiting: session.payment_status ?? '' })
  }
  const meta = session.metadata ?? {}
  const sessionId = text(session.id)
  const bookingId = Number(meta.bookingId)
  const baseCents = Number(meta.baseCents)
  const hst = Number(meta.hstCents)
  const kind = (['deposit', 'balance', 'full'].includes(text(meta.kind))
    ? meta.kind
    : 'balance') as CardKind
  if (
    !sessionId ||
    !Number.isInteger(bookingId) ||
    !Number.isInteger(baseCents) ||
    !Number.isInteger(hst) ||
    baseCents <= 0
  ) {
    return Response.json({ received: true, ignored: 'not a Piper invoice' })
  }
  const paymentId =
    typeof session.payment_intent === 'string'
      ? session.payment_intent
      : text(session.payment_intent?.id) || sessionId
  const live = session.livemode === true

  const claimed = await claimStripeSession({
    sessionId,
    bookingId,
    paymentId,
    kind,
    baseCents,
    hstCents: hst,
    live,
  })
  if (!claimed) return Response.json({ received: true, duplicate: true })

  const charged = Number(session.amount_total)
  const note = stripeNote({ paymentId, live, kind, hstCents: hst })
  if (Number.isFinite(charged) && charged !== baseCents + hst) {
    // Recorded as Stripe says it was charged; the owner is told to look.
    await finishStripeSession(
      sessionId,
      'needs-attention',
      `Charged ${charged}, expected ${baseCents + hst}.`,
    )
    await emailOwner({
      subject: 'Card payment needs a look',
      text: `Stripe session ${sessionId} charged ${charged} cents for booking ${bookingId}, but ${baseCents + hst} was expected. Nothing was recorded. Check the payment in Stripe and record it by hand.`,
    }).catch(() => undefined)
    return Response.json({ received: true, attention: true })
  }
  try {
    await addPayment(bookingId, baseCents, note, torontoToday(), 'card')
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error'
    // A date already taken by another booking, or a void invoice: the money
    // is in Stripe, so stop Stripe retrying and tell the owner instead.
    if (/taken|booked|void|not on the book|no invoice/i.test(reason)) {
      await finishStripeSession(sessionId, 'needs-attention', reason)
      await emailOwner({
        subject: 'Card payment needs a look',
        text: `A card payment came in for booking ${bookingId} (${note}), but it could not be recorded: ${reason} Record it by hand once sorted.`,
      }).catch(() => undefined)
      return Response.json({ received: true, attention: true })
    }
    // Anything else (a database hiccup): let Stripe retry.
    await releaseStripeSession(sessionId)
    return new Response('Try again', { status: 500 })
  }
  await finishStripeSession(sessionId, 'recorded')
  try {
    await emailBooking(bookingId)
  } catch {
    // The payment stands even if the confirmation email cannot go.
  }
  return Response.json({ received: true, recorded: true })
}

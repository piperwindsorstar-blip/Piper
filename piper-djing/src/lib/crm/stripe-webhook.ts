import { dollars, stripeNote, verifyStripeSignature } from './card-pay.ts'
import type { CardKind } from './card-pay.ts'

/**
 * What the webhook needs from the book and the mail. stripe.server.ts wires
 * the real ones; tests pass a fake book.
 */
export type WebhookDeps = {
  webhookSecret: string
  today: () => string
  /** Takes the one slot for a Checkout session; false if already taken. */
  claim: (input: {
    sessionId: string
    bookingId: number
    paymentId: string
    kind: string
    baseCents: number
    hstCents: number
    live: boolean
  }) => Promise<boolean>
  finish: (
    sessionId: string,
    status: 'recorded' | 'needs-attention',
    detail?: string,
  ) => Promise<void>
  release: (sessionId: string) => Promise<void>
  /** Records the payment exactly as the desk does (and books a covered date). */
  record: (input: {
    bookingId: number
    cents: number
    hstCents: number
    note: string
    paidOn: string
  }) => Promise<{
    paymentId: number | null
    receivedCents: number
    totalCents: number
  }>
  emailOwner: (letter: { subject: string; text: string }) => Promise<void>
  emailReceipt: (bookingId: number, paymentId: number) => Promise<void>
  now?: number
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

/** Errors that will not fix themselves on a retry: tell the owner instead. */
const FINAL = /taken|held|booked|void|not on the book|no invoice/i

/**
 * Checks Stripe's signature, then records a paid Checkout session on the
 * desk once: the booking money as a card payment dated today in Toronto,
 * its HST in its own field. A paid deposit books the date exactly like a
 * deposit recorded by hand (clause 4.5); nothing here ever unbooks one.
 */
export async function processStripeWebhook(
  request: Request,
  deps: WebhookDeps,
): Promise<Response> {
  const payload = await request.text()
  const signed = await verifyStripeSignature(
    payload,
    request.headers.get('stripe-signature') ?? '',
    deps.webhookSecret,
    deps.now,
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

  const claimed = await deps.claim({
    sessionId,
    bookingId,
    paymentId,
    kind,
    baseCents,
    hstCents: hst,
    live,
  })
  if (!claimed) return Response.json({ received: true, duplicate: true })

  const note = stripeNote({ paymentId, live, kind })
  const charged = Number(session.amount_total)
  const currency = text(session.currency).toLowerCase()
  if (
    (Number.isFinite(charged) && charged !== baseCents + hst) ||
    (currency && currency !== 'cad')
  ) {
    await deps.finish(
      sessionId,
      'needs-attention',
      `Charged ${charged} ${currency}, expected ${baseCents + hst} cad.`,
    )
    await deps
      .emailOwner({
        subject: 'Card payment needs a look',
        text: `Stripe session ${sessionId} charged ${charged} ${currency || '?'} (cents) for booking ${bookingId}, but ${baseCents + hst} cad was expected. Nothing was recorded. Check the payment in Stripe and record it by hand.`,
      })
      .catch(() => undefined)
    return Response.json({ received: true, attention: true })
  }

  let recorded: Awaited<ReturnType<WebhookDeps['record']>>
  try {
    recorded = await deps.record({
      bookingId,
      cents: baseCents,
      hstCents: hst,
      note,
      paidOn: deps.today(),
    })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown error'
    if (FINAL.test(reason)) {
      // The money is in Stripe: stop Stripe retrying and tell the owner.
      await deps.finish(sessionId, 'needs-attention', reason)
      await deps
        .emailOwner({
          subject: 'Card payment needs a look',
          text: `A card payment came in for booking ${bookingId} (${note}), but it could not be recorded: ${reason} Record it by hand once sorted.`,
        })
        .catch(() => undefined)
      return Response.json({ received: true, attention: true })
    }
    // Anything else (a database hiccup): let Stripe retry.
    await deps.release(sessionId)
    return new Response('Try again', { status: 500 })
  }
  await deps.finish(sessionId, 'recorded')
  const over = Math.max(0, recorded.receivedCents - recorded.totalCents)
  if (over > 0) {
    await deps
      .emailOwner({
        subject: 'Card payment went over the balance',
        text: `A card payment for booking ${bookingId} (${note}) took the total paid ${dollars(over)} over the invoice. Refund the extra in Stripe if it is owed back.`,
      })
      .catch(() => undefined)
  }
  try {
    if (recorded.paymentId != null) {
      await deps.emailReceipt(bookingId, recorded.paymentId)
    }
  } catch {
    // The payment stands even if the receipt cannot go.
  }
  return Response.json({ received: true, recorded: true })
}

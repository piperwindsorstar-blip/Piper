import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { recordMoney } from './booking-rules.ts'
import type { BookingState, InvoiceState } from './booking-rules.ts'
import { cardQuote, checkoutForm, stripeSignature } from './card-pay.ts'
import { processStripeWebhook } from './stripe-webhook.ts'
import type { WebhookDeps } from './stripe-webhook.ts'

const SECRET = 'whsec_test_piper'
const NOW = 1_760_000_000_000

/** An open, real (non-sample) $1,650 full wedding day with a $500 deposit. */
function openBooking(over: Partial<BookingState> = {}): BookingState {
  return {
    partnerOne: 'Mark',
    partnerTwo: 'Mya',
    eventDate: '2028-11-15',
    stagDate: null,
    packageId: 'full',
    withStag: false,
    uplights: 0,
    venueKm: [],
    venueName: '',
    venueStreet: '',
    sample: false,
    discountCents: 0,
    status: 'open',
    totalCents: 165000,
    depositCents: 50000,
    holdStartedOn: null,
    stagReleased: false,
    ...over,
  }
}

/** A fake book that records money through the same rule the desk uses. */
function fakeBook(booking: BookingState, invoice: InvoiceState) {
  const book = {
    booking,
    invoice,
    payments: [] as { cents: number; hstCents: number; note: string; paidOn: string }[],
    claimed: new Set<string>(),
    finished: new Map<string, string>(),
    receipts: 0,
    ownerMail: [] as string[],
  }
  const deps: WebhookDeps = {
    webhookSecret: SECRET,
    now: NOW,
    today: () => '2026-10-13',
    claim: async ({ sessionId }) => {
      if (book.claimed.has(sessionId)) return false
      book.claimed.add(sessionId)
      return true
    },
    finish: async (sessionId, status) => {
      book.finished.set(sessionId, status)
    },
    release: async (sessionId) => {
      book.claimed.delete(sessionId)
    },
    record: async ({ cents, hstCents, note, paidOn }) => {
      const next = recordMoney(book.booking, book.invoice, cents)
      book.booking = next.booking
      book.invoice = next.invoice
      book.payments.push({ cents, hstCents, note, paidOn })
      return {
        paymentId: book.payments.length,
        receivedCents: book.invoice.receivedCents,
        totalCents: book.invoice.totalCents,
      }
    },
    emailOwner: async (letter) => {
      book.ownerMail.push(letter.subject)
    },
    emailReceipt: async () => {
      book.receipts += 1
    },
  }
  return { book, deps }
}

/** The event Stripe sends for a paid session built from our own form. */
async function signedEvent(input: {
  sessionId: string
  invoice: InvoiceState
  booking: BookingState
  currency?: string
}): Promise<Request> {
  const quote = cardQuote(
    { ...input.invoice, balanceCents: input.invoice.totalCents - input.invoice.receivedCents },
    { packageId: input.booking.packageId, packageName: 'Full wedding day' },
  )!
  const form = checkoutForm({
    quote,
    bookingId: 10,
    invoiceSlug: 'inv-10',
    email: '',
    successUrl: 's',
    cancelUrl: 'c',
    couple: 'Mark & Mya',
  })
  const metadata: Record<string, string> = {}
  for (const [key, value] of form) {
    const match = key.match(/^metadata\[(.+)\]$/)
    if (match?.[1]) metadata[match[1]] = value
  }
  const body = JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: input.sessionId,
        payment_status: 'paid',
        amount_total: quote.chargeCents,
        currency: input.currency ?? 'cad',
        livemode: false,
        payment_intent: `pi_${input.sessionId}`,
        metadata,
      },
    },
  })
  const t = Math.floor(NOW / 1000)
  const sig = await stripeSignature(body, t, SECRET)
  return new Request('https://piperpweddingdj.services/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': `t=${t},v1=${sig}` },
    body,
  })
}

describe('Stripe webhook', () => {
  it('a card deposit on an open, non-sample booking books the date', async () => {
    const invoice: InvoiceState = { status: 'sent', totalCents: 165000, depositCents: 50000, receivedCents: 0 }
    const { book, deps } = fakeBook(openBooking(), invoice)
    const response = await processStripeWebhook(
      await signedEvent({ sessionId: 'cs_dep', invoice, booking: book.booking }),
      deps,
    )
    assert.equal(response.status, 200)
    assert.equal(book.booking.status, 'booked')
    assert.deepEqual(book.payments, [
      { cents: 50000, hstCents: 0, note: 'Stripe pi_cs_dep (test) · deposit', paidOn: '2026-10-13' },
    ])
    assert.equal(book.finished.get('cs_dep'), 'recorded')
    assert.equal(book.receipts, 1)
  })

  it('also books when the invoice is still a draft', async () => {
    const invoice: InvoiceState = { status: 'draft', totalCents: 165000, depositCents: 50000, receivedCents: 0 }
    const { book, deps } = fakeBook(openBooking(), invoice)
    await processStripeWebhook(
      await signedEvent({ sessionId: 'cs_draft', invoice, booking: book.booking }),
      deps,
    )
    assert.equal(book.booking.status, 'booked')
  })

  it('the same session twice records once', async () => {
    const invoice: InvoiceState = { status: 'sent', totalCents: 165000, depositCents: 50000, receivedCents: 0 }
    const { book, deps } = fakeBook(openBooking(), invoice)
    const request = await signedEvent({ sessionId: 'cs_twice', invoice, booking: book.booking })
    await processStripeWebhook(request.clone(), deps)
    const again = await processStripeWebhook(request, deps)
    assert.deepEqual(await again.json(), { received: true, duplicate: true })
    assert.equal(book.payments.length, 1)
  })

  it('a balance payment never unbooks, and its HST is on this payment only', async () => {
    const invoice: InvoiceState = { status: 'sent', totalCents: 165000, depositCents: 50000, receivedCents: 50000 }
    const { book, deps } = fakeBook(openBooking({ status: 'booked' }), invoice)
    await processStripeWebhook(
      await signedEvent({ sessionId: 'cs_bal', invoice, booking: book.booking }),
      deps,
    )
    assert.equal(book.booking.status, 'booked')
    assert.equal(book.payments[0]?.cents, 115000)
    assert.equal(book.payments[0]?.hstCents, 14950)
    assert.equal(book.invoice.receivedCents, 165000)
  })

  it('a non-CAD charge is not recorded; the owner is told', async () => {
    const invoice: InvoiceState = { status: 'sent', totalCents: 165000, depositCents: 50000, receivedCents: 0 }
    const { book, deps } = fakeBook(openBooking(), invoice)
    await processStripeWebhook(
      await signedEvent({ sessionId: 'cs_usd', invoice, booking: book.booking, currency: 'usd' }),
      deps,
    )
    assert.equal(book.payments.length, 0)
    assert.equal(book.booking.status, 'open')
    assert.equal(book.finished.get('cs_usd'), 'needs-attention')
    assert.deepEqual(book.ownerMail, ['Card payment needs a look'])
  })

  it('a taken date stops Stripe retrying and tells the owner', async () => {
    const invoice: InvoiceState = { status: 'sent', totalCents: 165000, depositCents: 50000, receivedCents: 0 }
    const { book, deps } = fakeBook(openBooking(), invoice)
    deps.record = async () => {
      throw new Error('That wedding date is already held.')
    }
    const response = await processStripeWebhook(
      await signedEvent({ sessionId: 'cs_taken', invoice, booking: book.booking }),
      deps,
    )
    assert.equal(response.status, 200)
    assert.equal(book.finished.get('cs_taken'), 'needs-attention')
  })

  it('refuses a bad signature', async () => {
    const { deps } = fakeBook(openBooking(), { status: 'sent', totalCents: 165000, depositCents: 50000, receivedCents: 0 })
    const response = await processStripeWebhook(
      new Request('https://x/api/stripe/webhook', {
        method: 'POST',
        headers: { 'stripe-signature': 't=1,v1=00' },
        body: '{}',
      }),
      deps,
    )
    assert.equal(response.status, 400)
  })
})

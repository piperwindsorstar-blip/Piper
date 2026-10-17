import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { stripeSignature } from '../crm/card-pay.ts'
import { processStripeWebhook } from '../crm/stripe-webhook.ts'
import type { WebhookDeps } from '../crm/stripe-webhook.ts'
import {
  matchesPaidBooking,
  paidLabel,
  parsePurchase,
  placePurchase,
  rsvpCheckoutForm,
  rsvpQuote,
} from './purchase.ts'
import type { PriceBooking, RsvpPurchase } from './purchase.ts'

const purchase: RsvpPurchase = {
  partnerOne: 'Mark',
  partnerTwo: 'Mya',
  email: 'mark.mya@example.com',
  eventDate: '2028-11-15',
  bookingRef: '',
}

const booked: PriceBooking = {
  email: 'Mark.Mya@example.com',
  invoiceSlug: 'k7Qx92ab',
  sample: false,
  status: 'booked',
  depositCents: 50000,
  receivedCents: 50000,
}

describe('RSVP page price', () => {
  it('matched booking: $20 + $2.60 HST = $22.60', () => {
    assert.equal(matchesPaidBooking(purchase, [booked]), true)
    const quote = rsvpQuote(true)
    assert.deepEqual(
      { base: quote.baseCents, hst: quote.hstCents, total: quote.chargeCents, kind: quote.kind },
      { base: 2000, hst: 260, total: 2260, kind: 'piper' },
    )
    assert.equal(paidLabel(quote), '$20.00 + $2.60 HST = $22.60')
  })

  it('unmatched: $30 + $3.90 HST = $33.90', () => {
    assert.equal(matchesPaidBooking({ ...purchase, email: 'someone@else.ca' }, [booked]), false)
    const quote = rsvpQuote(false)
    assert.deepEqual(
      { base: quote.baseCents, hst: quote.hstCents, total: quote.chargeCents, kind: quote.kind },
      { base: 3000, hst: 390, total: 3390, kind: 'standalone' },
    )
  })

  it('matches by booking email or invoice code typed in the optional box', () => {
    const other = { ...purchase, email: 'new@inbox.ca' }
    assert.equal(matchesPaidBooking({ ...other, bookingRef: 'mark.mya@example.com' }, [booked]), true)
    assert.equal(matchesPaidBooking({ ...other, bookingRef: 'K7QX92AB' }, [booked]), true)
    assert.equal(
      matchesPaidBooking({ ...other, bookingRef: 'https://piperpweddingdj.services/p/k7Qx92ab' }, [booked]),
      true,
    )
    assert.equal(matchesPaidBooking({ ...other, bookingRef: 'wrong-code' }, [booked]), false)
  })

  it('needs the deposit in: no deposit, a sample, or a cancelled date is $30', () => {
    const noDeposit = { ...booked, status: 'hold', receivedCents: 20000 }
    assert.equal(matchesPaidBooking(purchase, [noDeposit]), false)
    assert.equal(matchesPaidBooking(purchase, [{ ...noDeposit, receivedCents: 50000 }]), true)
    assert.equal(matchesPaidBooking(purchase, [{ ...booked, sample: true }]), false)
    assert.equal(matchesPaidBooking(purchase, [{ ...booked, status: 'cancelled' }]), false)
  })

  it('checks the form', () => {
    assert.equal(parsePurchase({ partnerOne: 'A' }).ok, false)
    assert.equal(parsePurchase({ ...purchase, email: 'nope' }).ok, false)
    assert.equal(parsePurchase({ ...purchase, eventDate: 'soon' }).ok, false)
    const ok = parsePurchase({ ...purchase, email: ' Mark.Mya@Example.com ' })
    assert.ok(ok.ok)
    assert.equal(ok.purchase.email, 'mark.mya@example.com')
  })

  it('checkout is CAD only with adaptive pricing off', () => {
    const form = rsvpCheckoutForm({ quote: rsvpQuote(true), purchase, successUrl: 's', cancelUrl: 'c' })
    assert.equal(form.get('currency'), 'cad')
    assert.equal(form.get('adaptive_pricing[enabled]'), 'false')
    assert.equal(form.get('line_items[0][price_data][unit_amount]'), '2000')
    assert.equal(form.get('line_items[1][price_data][unit_amount]'), '260')
    assert.equal(form.get('line_items[1][price_data][product_data][name]'), 'HST 13% on this card payment of $20.00')
    const currencies = [...form].filter(([key]) => key.endsWith('[currency]')).map(([, v]) => v)
    assert.deepEqual([...new Set(currencies)], ['cad'])
    assert.equal(form.get('metadata[purpose]'), 'rsvp')
  })
})

describe('where a paid purchase goes', () => {
  it('makes a new site at the names slug', () => {
    assert.deepEqual(placePurchase([], purchase), { outcome: 'created', slug: 'mark-and-mya' })
  })
  it('the same email already has a site: pay that one', () => {
    assert.deepEqual(
      placePurchase([{ slug: 'markmya-2028', email: 'MARK.MYA@example.com' }], purchase),
      { outcome: 'attached', slug: 'markmya-2028' },
    )
  })
  it('the slug belongs to another email: no new site, owner checks', () => {
    assert.deepEqual(
      placePurchase([{ slug: 'mark-and-mya', email: 'other@example.com' }], purchase),
      { outcome: 'needs-check', slug: 'mark-and-mya' },
    )
  })
})

const SECRET = 'whsec_rsvp'
const NOW = 1_760_000_000_000

async function paidRsvpEvent(sessionId: string, currency = 'cad', matched = false) {
  const form = rsvpCheckoutForm({ quote: rsvpQuote(matched), purchase, successUrl: 's', cancelUrl: 'c' })
  const metadata: Record<string, string> = {}
  for (const [key, value] of form) {
    const hit = key.match(/^metadata\[(.+)\]$/)
    if (hit?.[1]) metadata[hit[1]] = value
  }
  const body = JSON.stringify({
    type: 'checkout.session.completed',
    data: {
      object: {
        id: sessionId,
        payment_status: 'paid',
        amount_total: rsvpQuote(matched).chargeCents,
        currency,
        livemode: false,
        payment_intent: `pi_${sessionId}`,
        metadata,
      },
    },
  })
  const t = Math.floor(NOW / 1000)
  return new Request('https://piperpweddingdj.services/api/stripe/webhook', {
    method: 'POST',
    headers: { 'stripe-signature': `t=${t},v1=${await stripeSignature(body, t, SECRET)}` },
    body,
  })
}

function fakeDeps() {
  const claimed = new Set<string>()
  const sites: { slug: string; email: string }[] = []
  const finished = new Map<string, string>()
  const owner: string[] = []
  const deps: WebhookDeps = {
    webhookSecret: SECRET,
    now: NOW,
    today: () => '2026-10-13',
    claim: async ({ sessionId }) => {
      if (claimed.has(sessionId)) return false
      claimed.add(sessionId)
      return true
    },
    finish: async (id, status) => {
      finished.set(id, status)
    },
    release: async (id) => {
      claimed.delete(id)
    },
    record: async () => {
      throw new Error('not a booking payment')
    },
    emailOwner: async (letter) => {
      owner.push(letter.subject)
    },
    emailReceipt: async () => undefined,
    rsvpPurchase: async (input) => {
      const place = placePurchase(sites, input.purchase)
      if (place.outcome === 'created') sites.push({ slug: place.slug, email: input.purchase.email })
      return place
    },
  }
  return { deps, sites, finished, owner }
}

describe('RSVP purchase webhook', () => {
  it('a duplicate webhook for one session makes one site', async () => {
    const { deps, sites, finished } = fakeDeps()
    const event = await paidRsvpEvent('cs_rsvp_1')
    const first = await processStripeWebhook(event.clone(), deps)
    assert.equal(first.status, 200)
    const again = await processStripeWebhook(event, deps)
    assert.deepEqual(await again.json(), { received: true, duplicate: true })
    assert.deepEqual(sites, [{ slug: 'mark-and-mya', email: 'mark.mya@example.com' }])
    assert.equal(finished.get('cs_rsvp_1'), 'recorded')
  })

  it('a second paid session from the same couple pays the same site, no duplicate', async () => {
    const { deps, sites } = fakeDeps()
    await processStripeWebhook(await paidRsvpEvent('cs_a'), deps)
    const second = await processStripeWebhook(await paidRsvpEvent('cs_b'), deps)
    const body = (await second.json()) as { rsvp: { outcome: string } }
    assert.equal(body.rsvp.outcome, 'attached')
    assert.equal(sites.length, 1)
  })

  it('a non-CAD charge is rejected: no site, the owner is told', async () => {
    const { deps, sites, finished, owner } = fakeDeps()
    await processStripeWebhook(await paidRsvpEvent('cs_usd', 'usd'), deps)
    assert.equal(sites.length, 0)
    assert.equal(finished.get('cs_usd'), 'needs-attention')
    assert.deepEqual(owner, ['RSVP purchase needs a look'])
  })
})

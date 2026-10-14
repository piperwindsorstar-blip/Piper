import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cardQuote,
  checkoutForm,
  hstCents,
  stripeFromNote,
  stripeNote,
  stripeSignature,
  verifyStripeSignature,
} from './card-pay.ts'

const wedding = { packageId: 'full', packageName: 'Full wedding day' }
const invoice = (over: Partial<Parameters<typeof cardQuote>[0]> = {}) => {
  const base = {
    status: 'sent',
    totalCents: 165000,
    depositCents: 49500,
    receivedCents: 0,
    balanceCents: 165000,
    ...over,
  }
  return { ...base, balanceCents: base.totalCents - base.receivedCents }
}

test('HST is 13% of the full total', () => {
  assert.equal(hstCents(165000), 21450)
  assert.equal(hstCents(35000), 4550)
})

test('$1,650 wedding: deposit by card has no HST', () => {
  const quote = cardQuote(invoice(), wedding)
  assert.deepEqual(quote && { kind: quote.kind, base: quote.baseCents, hst: quote.hstCents, charge: quote.chargeCents }, {
    kind: 'deposit', base: 49500, hst: 0, charge: 49500,
  })
})

test('$1,650 wedding: balance by card is $1,155 + $214.50 = $1,369.50', () => {
  const quote = cardQuote(invoice({ receivedCents: 49500 }), wedding)
  assert.equal(quote?.kind, 'balance')
  assert.equal(quote?.baseCents, 115500)
  assert.equal(quote?.hstCents, 21450)
  assert.equal(quote?.chargeCents, 136950)
  assert.equal(quote?.hstOnCents, 165000)
})

test('the site deposit rule ($500) gives $1,150 + $214.50 = $1,364.50', () => {
  const quote = cardQuote(invoice({ depositCents: 50000, receivedCents: 50000 }), wedding)
  assert.equal(quote?.chargeCents, 136450)
})

test('part of the deposit already paid by e-transfer: card takes the rest, no HST', () => {
  const quote = cardQuote(invoice({ receivedCents: 20000 }), wedding)
  assert.equal(quote?.kind, 'deposit')
  assert.equal(quote?.chargeCents, 29500)
})

test('ceremony only: $350 + $45.50 HST in one payment', () => {
  const quote = cardQuote(
    invoice({ totalCents: 35000, depositCents: 35000 }),
    { packageId: 'ceremony', packageName: 'The Aisle' },
  )
  assert.equal(quote?.kind, 'full')
  assert.equal(quote?.chargeCents, 39550)
})

test('custom with no price, paid up, or void: no card button', () => {
  assert.equal(cardQuote(invoice({ totalCents: 0, depositCents: 0 }), { packageId: 'custom', packageName: 'Custom' }), null)
  assert.equal(cardQuote(invoice({ receivedCents: 165000 }), wedding), null)
  assert.equal(cardQuote(invoice({ status: 'void' }), wedding), null)
})

test('custom with an owner-set price uses that price', () => {
  const quote = cardQuote(invoice({ totalCents: 90000, depositCents: 27500, receivedCents: 27500 }), { packageId: 'custom', packageName: 'Custom' })
  assert.equal(quote?.chargeCents, 62500 + 11700)
})

test('checkout form charges CAD with a separate HST line', () => {
  const quote = cardQuote(invoice({ receivedCents: 49500 }), wedding)!
  const form = checkoutForm({ quote, bookingId: 7, invoiceSlug: 'abc', email: 'a@b.co', successUrl: 's', cancelUrl: 'c', couple: 'A & B' })
  assert.equal(form.get('line_items[0][price_data][currency]'), 'cad')
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '115500')
  assert.equal(form.get('line_items[1][price_data][unit_amount]'), '21450')
  assert.match(form.get('line_items[1][price_data][product_data][name]') ?? '', /HST 13% on the \$1,650.00 booking total/)
  assert.equal(form.get('metadata[baseCents]'), '115500')
  assert.equal(form.get('metadata[bookingId]'), '7')
})

test('webhook signature: right, wrong, and stale', async () => {
  const body = '{"id":"evt_1"}'
  const now = 1_760_000_000_000
  const t = Math.floor(now / 1000)
  const sig = await stripeSignature(body, t, 'whsec_test')
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${sig}`, 'whsec_test', now), true)
  assert.equal(await verifyStripeSignature(body + ' ', `t=${t},v1=${sig}`, 'whsec_test', now), false)
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${sig}`, 'whsec_other', now), false)
  assert.equal(await verifyStripeSignature(body, `t=${t},v1=${sig}`, 'whsec_test', now + 600_000), false)
  assert.equal(await verifyStripeSignature(body, '', 'whsec_test', now), false)
})

test('the desk note links back to the Stripe dashboard', () => {
  const note = stripeNote({ paymentId: 'pi_3Abc', live: false, kind: 'balance', hstCents: 21450 })
  assert.equal(note, 'Stripe pi_3Abc (test) · balance · card HST $214.50 collected')
  assert.deepEqual(stripeFromNote(note), { paymentId: 'pi_3Abc', live: false, dashboardUrl: 'https://dashboard.stripe.com/test/payments/pi_3Abc' })
  assert.equal(stripeFromNote(stripeNote({ paymentId: 'pi_9', live: true, kind: 'deposit', hstCents: 0 }))?.dashboardUrl, 'https://dashboard.stripe.com/payments/pi_9')
  assert.equal(stripeFromNote('e-transfer from Mya'), null)
})

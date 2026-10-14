import assert from 'node:assert/strict'
import { test } from 'node:test'
import {
  cardPayment,
  cardQuote,
  checkoutForm,
  hstCents,
  hstLabel,
  parseAmount,
  stripeFromNote,
  stripeNote,
  stripeSignature,
  verifyStripeSignature,
} from './card-pay.ts'
import type { CardQuote, QuoteInvoice } from './card-pay.ts'

const wedding = { packageId: 'full', packageName: 'Full wedding day' }

/** A $1,650 booking with the site's $500 deposit, after `received` is paid. */
function invoice(received: number, over: Partial<QuoteInvoice> = {}): QuoteInvoice {
  const base = { status: 'sent', totalCents: 165000, depositCents: 50000, ...over }
  return {
    ...base,
    receivedCents: received,
    balanceCents: Math.max(0, base.totalCents - received),
  }
}

function amounts(quote: CardQuote | null) {
  return quote && { base: quote.baseCents, hst: quote.hstCents, charge: quote.chargeCents }
}

test('HST is 13% of the amount given', () => {
  assert.equal(hstCents(115000), 14950)
  assert.equal(hstCents(50000), 6500)
  assert.equal(hstCents(35000), 4550)
})

test('$1,650 booking: deposit $500 by card is $500.00 with no HST', () => {
  const quote = cardQuote(invoice(0), wedding)
  assert.equal(quote?.kind, 'deposit')
  assert.equal(quote?.adjustable, false)
  assert.deepEqual(amounts(quote), { base: 50000, hst: 0, charge: 50000 })
})

test('$1,650 booking: full balance $1,150 by card is $1,150 + $149.50 = $1,299.50', () => {
  const quote = cardQuote(invoice(50000), wedding)
  assert.equal(quote?.kind, 'balance')
  assert.deepEqual(amounts(quote), { base: 115000, hst: 14950, charge: 129950 })
  assert.equal(quote?.minCents, 5000)
  assert.equal(quote?.maxCents, 115000)
})

test('partial: $500 by card is $565.00, then $650 by e-transfer leaves $0', () => {
  const due = cardQuote(invoice(50000), wedding)!
  const part = cardPayment(due, 50000)
  assert.ok(part.ok)
  assert.deepEqual(amounts(part.quote), { base: 50000, hst: 6500, charge: 56500 })
  // Only the $500 counts toward the balance; the $65 HST is on top.
  const afterCard = invoice(50000 + part.quote.baseCents)
  assert.equal(afterCard.balanceCents, 65000)
  const next = cardQuote(afterCard, wedding)
  assert.equal(next?.maxCents, 65000)
  assert.deepEqual(amounts(next), { base: 65000, hst: 8450, charge: 73450 })
  // The owner records $650 by e-transfer: nothing left, no card button.
  const afterTransfer = invoice(afterCard.receivedCents + 65000)
  assert.equal(afterTransfer.balanceCents, 0)
  assert.equal(cardQuote(afterTransfer, wedding), null)
})

test('amount to pay: $50 minimum, remaining maximum', () => {
  const due = cardQuote(invoice(50000), wedding)!
  assert.equal(cardPayment(due, 4999).ok, false)
  assert.equal(cardPayment(due, 5000).ok, true)
  assert.equal(cardPayment(due, 115001).ok, false)
  assert.equal(cardPayment(due, 115000).ok, true)
  assert.equal(cardPayment(due).ok, true)
  // Less than $50 left: that amount is the minimum.
  const small = cardQuote(invoice(162000), wedding)!
  assert.equal(small.minCents, 3000)
  assert.equal(cardPayment(small, 3000).ok, true)
})

test('deposit and ceremony amounts cannot be changed', () => {
  const deposit = cardQuote(invoice(0), wedding)!
  assert.equal(cardPayment(deposit, 20000).ok, false)
  assert.equal(cardPayment(deposit, 50000).ok, true)
})

test('e-transfer toward the deposit lowers what the card deposit takes, still no HST', () => {
  const quote = cardQuote(invoice(20000), wedding)
  assert.equal(quote?.kind, 'deposit')
  assert.deepEqual(amounts(quote), { base: 30000, hst: 0, charge: 30000 })
})

test('ceremony only by card: $350 + $45.50 = $395.50', () => {
  const quote = cardQuote(
    invoice(0, { totalCents: 35000, depositCents: 35000 }),
    { packageId: 'ceremony', packageName: 'The Aisle' },
  )
  assert.equal(quote?.kind, 'full')
  assert.deepEqual(amounts(quote), { base: 35000, hst: 4550, charge: 39550 })
})

test('custom with no price, paid up, or void: no card button', () => {
  const custom = { packageId: 'custom', packageName: 'Custom' }
  assert.equal(cardQuote(invoice(0, { totalCents: 0, depositCents: 0 }), custom), null)
  assert.equal(cardQuote(invoice(165000), wedding), null)
  assert.equal(cardQuote(invoice(0, { status: 'void' }), wedding), null)
})

test('custom with an owner-set price uses that price', () => {
  const quote = cardQuote(
    invoice(27500, { totalCents: 90000, depositCents: 27500 }),
    { packageId: 'custom', packageName: 'Custom' },
  )
  assert.deepEqual(amounts(quote), { base: 62500, hst: 8125, charge: 70625 })
})

test('the HST line names this card payment', () => {
  assert.equal(hstLabel(115000), 'HST 13% on this card payment of $1,150.00')
})

test('typed amounts', () => {
  assert.equal(parseAmount('500'), 50000)
  assert.equal(parseAmount('$1,150.5'), 115050)
  assert.ok(Number.isNaN(parseAmount('abc')))
  assert.ok(Number.isNaN(parseAmount('1.234')))
})

test('checkout form charges CAD with a separate HST line on this payment', () => {
  const due = cardQuote(invoice(50000), wedding)!
  const part = cardPayment(due, 50000)
  assert.ok(part.ok)
  const form = checkoutForm({ quote: part.quote, bookingId: 7, invoiceSlug: 'abc', email: 'a@b.co', successUrl: 's', cancelUrl: 'c', couple: 'A & B' })
  assert.equal(form.get('line_items[0][price_data][currency]'), 'cad')
  assert.equal(form.get('line_items[0][price_data][unit_amount]'), '50000')
  assert.equal(form.get('line_items[1][price_data][unit_amount]'), '6500')
  assert.equal(form.get('line_items[1][price_data][product_data][name]'), 'HST 13% on this card payment of $500.00')
  assert.equal(form.get('metadata[baseCents]'), '50000')
  assert.equal(form.get('metadata[hstCents]'), '6500')
  // A deposit has no HST line at all.
  const deposit = checkoutForm({ quote: cardQuote(invoice(0), wedding)!, bookingId: 7, invoiceSlug: 'abc', email: '', successUrl: 's', cancelUrl: 'c', couple: 'A & B' })
  assert.equal(deposit.get('line_items[1][price_data][unit_amount]'), null)
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
  const note = stripeNote({ paymentId: 'pi_3Abc', live: false, kind: 'balance' })
  assert.equal(note, 'Stripe pi_3Abc (test) · balance')
  assert.deepEqual(stripeFromNote(note), { paymentId: 'pi_3Abc', live: false, dashboardUrl: 'https://dashboard.stripe.com/test/payments/pi_3Abc' })
  assert.equal(stripeFromNote(stripeNote({ paymentId: 'pi_9', live: true, kind: 'deposit' }))?.dashboardUrl, 'https://dashboard.stripe.com/payments/pi_9')
  assert.equal(stripeFromNote('e-transfer from Mya'), null)
})

test('checkout is CAD only: CAD prices, CAD session, no adaptive pricing', () => {
  for (const quote of [
    cardQuote(invoice(0), wedding)!,
    cardQuote(invoice(50000), wedding)!,
    cardQuote(invoice(0, { totalCents: 35000, depositCents: 35000 }), { packageId: 'ceremony', packageName: 'The Aisle' })!,
  ]) {
    const form = checkoutForm({ quote, bookingId: 1, invoiceSlug: 'x', email: '', successUrl: 's', cancelUrl: 'c', couple: 'A & B' })
    assert.equal(form.get('currency'), 'cad')
    assert.equal(form.get('adaptive_pricing[enabled]'), 'false')
    const currencies = [...form].filter(([key]) => key.endsWith('[currency]')).map(([, value]) => value)
    assert.ok(currencies.length > 0)
    assert.deepEqual([...new Set(currencies)], ['cad'])
  }
})

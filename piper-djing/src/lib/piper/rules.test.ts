import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CEREMONY_DEPOSIT_CENTS,
  FULL_PLUS_STAG_DEPOSIT_CENTS,
  HOLD_DAYS,
  UPLIGHT_CENTS,
  deposit30,
  holdCovers,
  quote,
  requiredDeposit,
  torontoToday,
  travelCents,
  travelForVenues,
  uplightCents,
} from './rules.ts'

describe('deposit30', () => {
  it('rounds 30% to the nearest $25', () => {
    assert.equal(deposit30(165000), 50000)
    assert.equal(deposit30(155000), 47500)
    assert.equal(deposit30(70000), 20000)
    assert.equal(deposit30(35000), 10000)
  })

  it('rounds an exact half down', () => {
    // 30% of 162500 cents is 48750, which is exactly halfway between $475 and $500.
    assert.equal(deposit30(162500), 47500)
  })
})

describe('travel and uplights', () => {
  it('charges uplights at $15 each', () => {
    assert.equal(UPLIGHT_CENTS, 1500)
    assert.equal(uplightCents(4), 6000)
  })

  it('calculates travel from kilometres', () => {
    assert.equal(travelCents(10), 0)
    assert.equal(travelCents(20), 0)
    assert.equal(travelCents(21), 150)
  })

  it('allows two venues and refuses a third', () => {
    assert.equal(travelForVenues([21, 30]), 150 + 1500)
    assert.throws(() => travelForVenues([1, 2, 3]), /Two venues/)
  })
})

describe('packages', () => {
  it('keeps the locked package totals', () => {
    assert.equal(quote({ packageId: 'full', withStag: false, uplights: 0, venueKm: [] }).totalCents, 165000)
    assert.equal(quote({ packageId: 'reception', withStag: false, uplights: 0, venueKm: [] }).totalCents, 155000)
    assert.equal(quote({ packageId: 'stag', withStag: false, uplights: 0, venueKm: [] }).totalCents, 70000)
    assert.equal(quote({ packageId: 'ceremony', withStag: false, uplights: 0, venueKm: [] }).totalCents, 35000)
  })

  it('books a full day plus a stag as one total with a $500 deposit', () => {
    const quoted = quote({ packageId: 'full', withStag: true, uplights: 0, venueKm: [] })
    assert.equal(quoted.totalCents, 165000 + 70000)
    assert.equal(quoted.depositCents, FULL_PLUS_STAG_DEPOSIT_CENTS)
  })

  it('keeps the ceremony deposit at the full amount', () => {
    assert.equal(
      requiredDeposit({ packageId: 'ceremony', withStag: false, invoiceDepositCents: 1000 }),
      CEREMONY_DEPOSIT_CENTS,
    )
  })
})

describe('hold window', () => {
  it('counts 30 days including the start', () => {
    assert.equal(HOLD_DAYS, 30)
    assert.equal(holdCovers('2027-01-01', '2027-01-01'), true)
    assert.equal(holdCovers('2027-01-01', '2027-01-30'), true)
    assert.equal(holdCovers('2027-01-01', '2027-01-31'), false)
  })

  it('uses the Toronto calendar day', () => {
    assert.equal(torontoToday(new Date('2026-10-07T02:30:00.000Z')), '2026-10-06')
    assert.equal(torontoToday(new Date('2026-10-07T04:30:00.000Z')), '2026-10-07')
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CEREMONY_DEPOSIT_CENTS,
  FULL_PLUS_STAG_DEPOSIT_CENTS,
  HOLD_DAYS,
  UPLIGHT_CENTS,
  applyDiscount,
  deposit30,
  holdCovers,
  quote,
  requiredDeposit,
  STAG_DEPOSIT_CENTS,
  torontoToday,
  travelCents,
  travelCharge,
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

  it('charges one-way distance in bands and adds a hotel past 200 km', () => {
    assert.equal(travelCents(49.9), 0)
    assert.deepEqual(travelCharge(50), { cents: 11000, hotel: false })
    assert.deepEqual(travelCharge(100), { cents: 11000, hotel: false })
    assert.deepEqual(travelCharge(100.1), { cents: 25000, hotel: false })
    assert.deepEqual(travelCharge(200), { cents: 25000, hotel: false })
    assert.deepEqual(travelCharge(200.1), { cents: 25000, hotel: true })
    assert.throws(() => travelCents(-1), /kilometres/)
  })

  it('allows two venues and refuses a third', () => {
    assert.deepEqual(travelForVenues([40, 80]), {
      cents: 11000,
      hotel: false,
    })
    assert.deepEqual(travelForVenues([80, 220]), {
      cents: 11000 + 25000,
      hotel: true,
    })
    assert.throws(() => travelForVenues([1, 2, 3]), /Two venues/)
  })

  it('includes travel on ceremony only and deposits a stag at $350', () => {
    const ceremony = quote({
      packageId: 'ceremony',
      withStag: false,
      uplights: 0,
      venueKm: [220],
    })
    assert.equal(ceremony.totalCents, 35000)
    assert.equal(ceremony.depositCents, 35000)
    assert.equal(ceremony.hotel, false)
    const stag = quote({
      packageId: 'stag',
      withStag: false,
      uplights: 0,
      venueKm: [80],
    })
    assert.equal(stag.totalCents, 70000 + 11000)
    assert.equal(stag.depositCents, STAG_DEPOSIT_CENTS)
    assert.equal(stag.hotel, false)
    const far = quote({
      packageId: 'full',
      withStag: false,
      uplights: 0,
      venueKm: [240],
    })
    assert.equal(far.totalCents, 165000 + 25000)
    assert.equal(far.hotel, true)
    assert.equal(
      requiredDeposit({
        packageId: 'stag',
        withStag: false,
        invoiceDepositCents: 1000,
      }),
      STAG_DEPOSIT_CENTS,
    )
    const discounted = applyDiscount(stag, 70000, {
      packageId: 'stag',
      withStag: false,
    })
    assert.equal(discounted.totalCents, 11000)
    assert.equal(discounted.depositCents, 11000)
    assert.equal(discounted.hotel, false)
  })
})

describe('packages', () => {
  it('keeps the locked package totals', () => {
    assert.equal(
      quote({ packageId: 'full', withStag: false, uplights: 0, venueKm: [] })
        .totalCents,
      165000,
    )
    assert.equal(
      quote({
        packageId: 'reception',
        withStag: false,
        uplights: 0,
        venueKm: [],
      }).totalCents,
      155000,
    )
    assert.equal(
      quote({ packageId: 'stag', withStag: false, uplights: 0, venueKm: [] })
        .totalCents,
      70000,
    )
    assert.equal(
      quote({
        packageId: 'ceremony',
        withStag: false,
        uplights: 0,
        venueKm: [],
      }).totalCents,
      35000,
    )
  })

  it('books a full day plus a stag as one total with a $500 deposit', () => {
    const quoted = quote({
      packageId: 'full',
      withStag: true,
      uplights: 0,
      venueKm: [],
    })
    assert.equal(quoted.totalCents, 165000 + 70000)
    assert.equal(quoted.depositCents, FULL_PLUS_STAG_DEPOSIT_CENTS)
  })

  it('takes a custom discount off the total and calculates the deposit again', () => {
    const full = quote({
      packageId: 'full',
      withStag: false,
      uplights: 0,
      venueKm: [],
    })
    const discounted = applyDiscount(full, 10000, {
      packageId: 'full',
      withStag: false,
    })
    assert.equal(discounted.totalCents, 155000)
    assert.equal(discounted.depositCents, 47500)
    const ceremony = quote({
      packageId: 'ceremony',
      withStag: false,
      uplights: 0,
      venueKm: [],
    })
    const ceremonyOff = applyDiscount(ceremony, 5000, {
      packageId: 'ceremony',
      withStag: false,
    })
    assert.equal(ceremonyOff.totalCents, 30000)
    assert.equal(ceremonyOff.depositCents, 30000)
    const stag = quote({
      packageId: 'full',
      withStag: true,
      uplights: 0,
      venueKm: [],
    })
    const stagOff = applyDiscount(stag, 10000, {
      packageId: 'full',
      withStag: true,
    })
    assert.equal(stagOff.totalCents, 225000)
    assert.equal(stagOff.depositCents, 50000)
    assert.throws(
      () => applyDiscount(full, 200000, { packageId: 'full', withStag: false }),
      /larger than the total/,
    )
  })

  it('keeps the ceremony deposit at the full amount', () => {
    assert.equal(
      requiredDeposit({
        packageId: 'ceremony',
        withStag: false,
        invoiceDepositCents: 1000,
      }),
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
    assert.equal(
      torontoToday(new Date('2026-10-07T02:30:00.000Z')),
      '2026-10-06',
    )
    assert.equal(
      torontoToday(new Date('2026-10-07T04:30:00.000Z')),
      '2026-10-07',
    )
  })
})

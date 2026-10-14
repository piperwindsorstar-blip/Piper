import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { moneySummary } from './money-summary.ts'
import type { MoneyBooking, MoneyPayment } from './money-summary.ts'

function booking(
  id: number,
  eventDate: string,
  totalCents: number,
  receivedCents: number,
  extra: Partial<MoneyBooking> = {},
): MoneyBooking {
  return {
    id,
    slug: `b-${id}`,
    partnerOne: `A${id}`,
    partnerTwo: `B${id}`,
    email: '',
    eventDate,
    packageName: 'Custom event',
    status: 'booked',
    sample: false,
    totalCents,
    invoice: {
      slug: `inv-${id}`,
      status: 'sent',
      totalCents,
      receivedCents,
      balanceCents: totalCents - receivedCents,
    },
    ...extra,
  }
}

function payment(id: number, bookingId: number, cents: number, paidOn: string, extra: Partial<MoneyPayment> = {}): MoneyPayment {
  return { id, bookingId, names: `A${bookingId} and B${bookingId}`, cents, note: '', paidOn, method: 'e-transfer', hstCents: 0, ...extra }
}

describe('money summary', () => {
  const book = [
    booking(10, '2026-10-29', 100000, 30000),
    booking(1, '2027-07-17', 140000, 40000),
    booking(2, '2027-06-20', 130000, 30000),
    booking(3, '2027-06-05', 170000, 50000),
    booking(4, '2027-03-12', 100000, 30000),
  ]
  const paid = [
    payment(5, 10, 30000, '2026-09-29'),
    payment(1, 1, 40000, '2026-09-01'),
    payment(2, 2, 30000, '2026-09-01'),
    payment(3, 3, 50000, '2026-09-01'),
    payment(4, 4, 30000, '2026-09-01'),
  ]

  it('matches the desk: $6,400 booked, $1,800 collected, $4,600 to collect', () => {
    const { totals } = moneySummary(book, paid)
    assert.equal(totals.bookedCents, 640000)
    assert.equal(totals.collectedCents, 180000)
    assert.equal(totals.stillToCollectCents, 460000)
    assert.equal(totals.receivedCents, 180000)
    assert.equal(totals.refundedCents, 0)
    assert.equal(totals.weddings, 5)
  })

  it('lists who owes by wedding date, soonest first, with what is left', () => {
    const { whoOwes } = moneySummary(book, paid)
    assert.deepEqual(
      whoOwes.map((row) => [row.bookingId, row.leftCents]),
      [[10, 70000], [4, 70000], [3, 120000], [2, 100000], [1, 100000]],
    )
    assert.equal(whoOwes[0]?.hasEmail, false)
  })

  it('leaves out samples, open, cancelled and released dates', () => {
    const extra = [
      booking(20, '2026-11-01', 50000, 0, { sample: true }),
      booking(21, '2026-11-02', 50000, 0, { status: 'open' }),
      booking(22, '2026-11-03', 50000, 0, { status: 'cancelled' }),
      booking(23, '2026-11-04', 50000, 0, { status: 'released' }),
      booking(24, '2026-11-05', 50000, 0, { status: 'hold' }),
    ]
    const { totals, whoOwes } = moneySummary([...book, ...extra], paid)
    assert.equal(totals.bookedCents, 690000)
    assert.equal(totals.weddings, 6)
    assert.ok(whoOwes.some((row) => row.bookingId === 24))
    assert.ok(!whoOwes.some((row) => row.bookingId === 20))
  })

  it('drops paid-in-full couples from who owes', () => {
    const { whoOwes } = moneySummary([booking(30, '2026-12-01', 35000, 35000)], [])
    assert.equal(whoOwes.length, 0)
  })

  it('groups payments by month, newest first, with refunds and card HST apart', () => {
    const more = [
      ...paid,
      payment(6, 10, 20000, '2026-10-10', { method: 'card', hstCents: 2600 }),
      payment(7, 10, -5000, '2026-10-12'),
    ]
    const { totals, paymentsIn } = moneySummary(book, more, [
      { couple: 'X', baseCents: 2000, hstCents: 260, paidOn: '2026-10-11', live: true, outcome: 'paid' },
    ])
    assert.equal(totals.refundedCents, 5000)
    assert.equal(totals.receivedCents, 200000)
    assert.equal(totals.cardHstCents, 2860)
    assert.deepEqual(paymentsIn.map((m) => [m.month, m.netCents]), [['2026-10', 15000], ['2026-09', 180000]])
    const october = paymentsIn[0]?.payments ?? []
    assert.deepEqual(october.map((p) => [p.id, p.kind, p.chargedCents]), [[7, 'refund', 5000], [6, 'payment', 22600]])
  })
})

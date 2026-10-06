import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  type BookingState,
  type InvoiceState,
  cancelBooking,
  countedCents,
  dateIsTaken,
  figuresFor,
  invoiceBalance,
  markInvoiceSent,
  matchCustom,
  recordMoney,
  releaseBooking,
  voidInvoice,
} from './booking-rules.ts'

const base = (): BookingState => ({
  partnerOne: 'Alex',
  partnerTwo: 'Jordan',
  eventDate: '2027-08-14',
  stagDate: '2027-06-12',
  packageId: 'full',
  withStag: true,
  uplights: 0,
  venueKm: [],
  venueName: 'The Hall',
  venueStreet: '1 King Street',
  sample: false,
  status: 'open',
  totalCents: 235000,
  depositCents: 50000,
  holdStartedOn: null,
  stagReleased: false,
})

const draft = (): InvoiceState => ({
  status: 'draft',
  totalCents: 235000,
  depositCents: 50000,
  receivedCents: 0,
})

describe('custom weddings', () => {
  it('keeps the four saved totals and deposits', () => {
    const cases = [
      ['CJ', 'Laura', '2027-03-12', 100000, 30000],
      ['Kevin', 'Jasmine', '2027-06-05', 170000, 50000],
      ['Lance', 'Diana', '2027-06-20', 130000, 30000],
      ['Cobi', 'Cameron', '2027-07-17', 140000, 40000],
    ] as const
    for (const [one, two, date, total, deposit] of cases) {
      const figures = figuresFor({
        ...base(),
        partnerOne: one,
        partnerTwo: two,
        eventDate: date,
        withStag: false,
        packageId: 'full',
      })
      assert.equal(figures.totalCents, total)
      assert.equal(figures.depositCents, deposit)
    }
  })

  it('does not treat the same names on another date as an exception', () => {
    assert.equal(matchCustom('CJ', 'Laura', '2027-04-01'), null)
  })
})

describe('status', () => {
  it('starts a hold when a sent invoice has a venue and a street', () => {
    const result = markInvoiceSent(base(), draft(), new Date('2027-01-15T15:00:00.000Z'))
    assert.equal(result.booking.status, 'hold')
    assert.equal(result.booking.holdStartedOn, '2027-01-15')
    assert.equal(result.newlyBooked, false)
  })

  it('does not hold without a street', () => {
    const result = markInvoiceSent({ ...base(), venueStreet: '' }, draft(), new Date('2027-01-15T15:00:00.000Z'))
    assert.equal(result.booking.status, 'open')
  })

  it('books only when a sent invoice is above $0 and the deposit is cleared', () => {
    const held = markInvoiceSent(base(), draft(), new Date('2027-01-15T15:00:00.000Z'))
    const paid = recordMoney(held.booking, held.invoice, 50000)
    assert.equal(paid.booking.status, 'booked')
    assert.equal(paid.newlyBooked, true)
  })

  it('does not book a $0 total or a $0 deposit', () => {
    const held = markInvoiceSent(base(), { ...draft(), totalCents: 0, depositCents: 0 }, new Date('2027-01-15T15:00:00.000Z'))
    const paid = recordMoney(held.booking, held.invoice, 50000)
    assert.equal(paid.booking.status, 'hold')
    assert.equal(paid.newlyBooked, false)
  })

  it('does not set newlyBooked on a date that is already booked', () => {
    const booked = { ...base(), status: 'booked' as const, holdStartedOn: '2027-01-01' }
    const again = recordMoney(booked, { ...draft(), status: 'sent', receivedCents: 50000 }, 1000)
    assert.equal(again.newlyBooked, false)
    assert.equal(again.booking.status, 'booked')
  })

  it('does not unbook when money is refunded', () => {
    const booked = { ...base(), status: 'booked' as const }
    const refunded = recordMoney(booked, { ...draft(), status: 'sent', receivedCents: 50000 }, -50000)
    assert.equal(refunded.booking.status, 'booked')
    assert.equal(refunded.invoice.receivedCents, 0)
  })

  it('gives a void invoice a zero balance and keeps what was received', () => {
    const voided = voidInvoice(base(), { ...draft(), status: 'sent', receivedCents: 20000 })
    assert.equal(invoiceBalance(voided.invoice), 0)
    assert.equal(voided.invoice.receivedCents, 20000)
    assert.equal(voided.booking.status, 'open')
  })

  it('releases and cancels without booking', () => {
    assert.equal(releaseBooking(base(), draft()).booking.status, 'released')
    assert.equal(cancelBooking(base(), draft()).newlyBooked, false)
  })
})

describe('the public date check', () => {
  it('treats a live hold and a booking as taken', () => {
    const today = '2027-01-20'
    const hold: BookingState = { ...base(), status: 'hold', holdStartedOn: '2027-01-10' }
    const booked: BookingState = { ...base(), status: 'booked', eventDate: '2027-09-01' }
    assert.equal(dateIsTaken([hold], '2027-08-14', today), true)
    assert.equal(dateIsTaken([booked], '2027-09-01', today), true)
  })

  it('ignores samples and a released stag date', () => {
    const sample: BookingState = { ...base(), sample: true, status: 'booked' }
    const releasedStag: BookingState = {
      ...base(),
      status: 'booked',
      stagReleased: true,
    }
    assert.equal(dateIsTaken([sample], '2027-08-14', '2027-01-20'), false)
    assert.equal(dateIsTaken([releasedStag], '2027-06-12', '2027-01-20'), false)
    assert.equal(dateIsTaken([releasedStag], '2027-08-14', '2027-01-20'), true)
  })

  it('leaves samples out of the totals', () => {
    assert.equal(countedCents([{ ...base(), sample: true, totalCents: 999 }, base()]), 235000)
  })
})

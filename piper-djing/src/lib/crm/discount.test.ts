import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deskBotResponse } from '../bots/desk-rest.server.ts'
import { setLegacyDateReader } from '../legacy-book.server.ts'
import { recordMoney, SAVED_WEDDINGS } from './booking-rules.ts'
import type { BookingState, InvoiceState } from './booking-rules.ts'
import {
  countedTotal,
  createBooking,
  inviteBot,
  listBookings,
  updateBooking,
} from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const blank = {
  phone: '',
  stagDate: null,
  packageId: 'full',
  withStag: false,
  uplights: 0,
  venueKm: [] as number[],
  venueName: 'Hall',
  venueStreet: '1 Main',
  venueTwoName: '',
  venueTwoStreet: '',
  sample: true,
  notes: '',
}

describe('custom discounts', { skip: liveBook }, () => {
  it('lowers the total and deposit, and a later edit can clear it', async () => {
    setLegacyDateReader(async () => 'open')
    const before = await countedTotal()
    const saved = await createBooking({
      ...blank,
      partnerOne: 'Discount',
      partnerTwo: 'Pair',
      email: 'discount@example.com',
      eventDate: '2029-11-11',
      discountCents: 10000,
    })
    assert.equal(saved.discountCents, 10000)
    assert.equal(saved.totalCents, 155000)
    assert.equal(saved.depositCents, 47500)
    assert.equal(saved.invoice?.totalCents, 155000)
    assert.equal(await countedTotal(), before)
    const cleared = await updateBooking({
      ...blank,
      id: saved.id,
      partnerOne: 'Discount',
      partnerTwo: 'Pair',
      email: 'discount@example.com',
      eventDate: '2029-11-11',
      discountCents: 0,
    })
    assert.equal(cleared.discountCents, 0)
    assert.equal(cleared.totalCents, 165000)
    assert.equal(cleared.depositCents, 50000)
    assert.equal(cleared.status, 'open')
  })

  it('refuses a discount larger than the total and one on an agreed wedding', async () => {
    setLegacyDateReader(async () => 'open')
    await assert.rejects(
      () =>
        createBooking({
          ...blank,
          partnerOne: 'Too',
          partnerTwo: 'Much',
          email: 'too@example.com',
          eventDate: '2029-11-12',
          discountCents: 200000,
        }),
      /larger than the total/,
    )
    const cobi = SAVED_WEDDINGS.find((wedding) => wedding.partnerOne === 'Cobi')
    assert.ok(cobi)
    const row = (await listBookings()).find(
      (booking) => booking.eventDate === cobi.date,
    )
    assert.ok(row)
    await assert.rejects(
      () =>
        updateBooking({
          id: row.id,
          partnerOne: row.partnerOne,
          partnerTwo: row.partnerTwo,
          email: row.email,
          phone: row.phone,
          eventDate: row.eventDate,
          stagDate: row.stagDate,
          packageId: row.packageId,
          withStag: row.withStag,
          uplights: row.uplights,
          venueKm: row.venueKm,
          venueName: row.venueName,
          venueStreet: row.venueStreet,
          venueTwoName: row.venueTwoName,
          venueTwoStreet: row.venueTwoStreet,
          sample: row.sample,
          notes: row.notes,
          discountCents: 1000,
        }),
      /agreed total stays/,
    )
    const again = (await listBookings()).find(
      (booking) => booking.id === row.id,
    )
    assert.ok(again)
    assert.equal(again.totalCents, cobi.totalCents)
    assert.equal(again.discountCents, 0)
  })

  it('books a discounted ceremony when that full amount is paid', () => {
    const booking: BookingState = {
      partnerOne: 'Ada',
      partnerTwo: 'Bo',
      eventDate: '2029-11-13',
      stagDate: null,
      packageId: 'ceremony',
      withStag: false,
      uplights: 0,
      venueKm: [],
      venueName: 'Chapel',
      venueStreet: '2 Lane',
      sample: true,
      status: 'hold',
      totalCents: 30000,
      depositCents: 30000,
      discountCents: 5000,
      holdStartedOn: '2026-10-01',
      stagReleased: false,
    }
    const invoice: InvoiceState = {
      status: 'sent',
      totalCents: 30000,
      depositCents: 30000,
      receivedCents: 0,
    }
    const covered = recordMoney(booking, invoice, 30000, 35000)
    assert.equal(covered.newlyBooked, true)
    assert.equal(covered.booking.status, 'booked')
  })

  it('lets a writer set the discount in dollars', async () => {
    setLegacyDateReader(async () => 'open')
    const writer = await inviteBot('Discount Writer', 'writer')
    const saved = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/bookings', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${writer.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          partnerOne: 'Writer',
          partnerTwo: 'Discount',
          email: 'writer-discount@example.com',
          eventDate: '2029-11-14',
          packageId: 'reception',
          sample: true,
          discountDollars: '50.00',
        }),
      }),
      async () => 'no',
    )
    assert.equal(saved.status, 200)
    const body = (await saved.json()) as {
      booking: { id: number; totalCents: number; discountCents: number }
    }
    assert.equal(body.booking.discountCents, 5000)
    assert.equal(body.booking.totalCents, 150000)
    const edited = await deskBotResponse(
      new Request(`http://localhost/api/bots/v1/bookings/${body.booking.id}`, {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${writer.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ discountCents: 2500 }),
      }),
      async () => 'no',
    )
    assert.equal(edited.status, 200)
    const next = (await edited.json()) as {
      booking: {
        discountCents: number
        totalCents: number
        depositCents: number
      }
    }
    assert.equal(next.booking.discountCents, 2500)
    assert.equal(next.booking.totalCents, 152500)
  })
})

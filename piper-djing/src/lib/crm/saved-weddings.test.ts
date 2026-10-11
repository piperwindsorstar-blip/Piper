import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { SAVED_WEDDINGS } from './booking-rules.ts'
import { createBooking, listBookings, listPayments } from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('saved weddings', { skip: liveBook }, () => {
  it('copies the four booked weddings onto this book once', async () => {
    const first = await listBookings()
    assert.equal(first.length, 4)
    for (const wedding of SAVED_WEDDINGS) {
      const row = first.find((booking) => booking.eventDate === wedding.date)
      assert.ok(row)
      assert.equal(row.status, 'booked')
      assert.equal(row.partnerOne, wedding.partnerOne)
      assert.equal(row.partnerTwo, wedding.partnerTwo)
      assert.equal(row.venueName, wedding.venueName)
      assert.equal(row.venueStreet, '')
      assert.equal(row.email, '')
      assert.equal(row.phone, '')
      assert.equal(row.totalCents, wedding.totalCents)
      assert.equal(row.depositCents, wedding.depositClearedCents)
      assert.equal(row.invoice?.status, 'sent')
      assert.equal(row.invoice?.receivedCents, wedding.depositClearedCents)
      assert.equal(
        row.invoice?.balanceCents,
        wedding.totalCents - wedding.depositClearedCents,
      )
      assert.match(row.notes, /previous book/)
      assert.match(row.notes, new RegExp(wedding.venueName))
      assert.doesNotMatch(`${row.venueStreet} ${row.notes}`, /Butcher/)
    }
    const second = await listBookings()
    assert.equal(second.length, 4)
    assert.deepEqual(
      second.map((booking) => booking.id).sort(),
      first.map((booking) => booking.id).sort(),
    )
    const payments = await listPayments()
    assert.equal(payments.length, 4)
    assert.equal(
      payments.reduce((sum, payment) => sum + payment.cents, 0),
      SAVED_WEDDINGS.reduce(
        (sum, wedding) => sum + wedding.depositClearedCents,
        0,
      ),
    )
    const sample = SAVED_WEDDINGS[0]
    assert.ok(sample)
    await assert.rejects(
      () =>
        createBooking({
          partnerOne: sample.partnerOne,
          partnerTwo: sample.partnerTwo,
          email: 'couple@example.com',
          phone: '',
          eventDate: sample.date,
          stagDate: null,
          packageId: 'full',
          withStag: false,
          uplights: 0,
          venueKm: [],
          venueName: sample.venueName,
          venueStreet: '',
          venueTwoName: '',
          venueTwoStreet: '',
          sample: false,
          notes: '',
        }),
      /already on the book/,
    )
    assert.equal((await listBookings()).length, 4)
  })
})

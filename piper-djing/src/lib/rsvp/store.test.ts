import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addPayment,
  countedTotal,
  createBooking,
  removeBooking,
  sendInvoice,
} from '../crm/store.server.ts'
import { PIPER_RSVP_CENTS, STANDALONE_RSVP_CENTS } from './model.ts'
import {
  createRsvpWedding,
  deleteRsvp,
  quoteRsvpPrice,
  readRsvp,
} from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const bookingInput = {
  partnerOne: 'Rsvp',
  partnerTwo: 'Trial',
  email: 'paid-rsvp@example.com',
  phone: '555-0100',
  eventDate: '2030-04-04',
  stagDate: null,
  packageId: 'reception',
  withStag: false,
  uplights: 0,
  venueKm: [],
  venueName: 'The Hall',
  venueStreet: '1 Test Lane',
  venueTwoName: '',
  venueTwoStreet: '',
  sample: false,
  notes: '',
}

describe('rsvp store', { skip: liveBook }, () => {
  it('prices a paid booking at $20 and leaves the counted book unchanged', async () => {
    const before = await countedTotal()
    const alone = await quoteRsvpPrice('nobody-rsvp@example.com')
    assert.equal(alone.cents, STANDALONE_RSVP_CENTS)
    const booking = await createBooking(bookingInput)
    assert.equal(
      (await quoteRsvpPrice('paid-rsvp@example.com')).cents,
      STANDALONE_RSVP_CENTS,
    )
    await sendInvoice(booking.id)
    await addPayment(booking.id, 40_000, 'deposit')
    const paid = await quoteRsvpPrice('paid-rsvp@example.com')
    assert.equal(paid.cents, PIPER_RSVP_CENTS)
    assert.equal(paid.kind, 'piper')
    const created = await createRsvpWedding({
      partnerOne: 'Ada',
      partnerTwo: 'Lane',
      email: 'paid-rsvp@example.com',
      eventDate: '2030-08-08',
      venue: 'The Hall',
    })
    assert.equal(created.priceCents, PIPER_RSVP_CENTS)
    assert.equal(created.paid, false)
    assert.equal(created.replyEmail, 'paid-rsvp@example.com')
    assert.equal((await readRsvp(created.slug))?.email, 'paid-rsvp@example.com')
    await deleteRsvp(created.slug)
    await removeBooking(booking.id)
    assert.equal(await countedTotal(), before)
  })
})

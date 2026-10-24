// Desk saves and reloads stay cheap: every Book call is a round trip on the live site.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { takeBookCalls } from '../db.server.ts'
import { createBooking, listVenues, updateBooking } from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const input = {
  partnerOne: 'Desk',
  partnerTwo: 'Calls',
  email: 'desk.calls@example.com',
  phone: '',
  eventDate: '2031-06-14',
  stagDate: null,
  packageId: 'full',
  withStag: false,
  uplights: 0,
  venueKm: [],
  venueName: 'Calls Hall',
  venueStreet: '',
  venueTwoName: '',
  venueTwoStreet: '',
  sample: false,
  notes: '',
}

describe('desk calls', { skip: liveBook, concurrency: 1 }, () => {
  it('lists venues in one call however many bookings there are', async () => {
    const { id } = await createBooking(input)
    await createBooking({ ...input, partnerOne: 'Desk2', eventDate: '2031-06-21', venueName: 'Other Hall' })
    await listVenues()
    takeBookCalls()
    const venues = await listVenues()
    assert.equal(takeBookCalls(), 1)
    assert.ok(venues.some((venue) => venue.name === 'Calls Hall'))
    assert.ok(venues.some((venue) => venue.name === 'Other Hall'))
    await updateBooking({ ...input, id, notes: 'warm' })
    takeBookCalls()
    const saved = await updateBooking({ ...input, id, notes: 'saved' })
    assert.ok(takeBookCalls() <= 12)
    assert.equal(saved.notes, 'saved')
  })
})

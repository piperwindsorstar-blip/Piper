import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { setLegacyDateReader } from '../legacy-book.server.ts'
import {
  createBooking,
  listPlanContacts,
  listPlanProgress,
  updateBooking,
} from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const base = {
  email: 'dana@example.com',
  phone: '',
  stagDate: null,
  withStag: false,
  uplights: 0,
  venueKm: [] as number[],
  venueName: 'Best Western Brant Park',
  venueStreet: '19 Holiday Dr, Brantford, ON',
  venueTwoName: '',
  venueTwoStreet: '',
  sample: true,
  notes: '',
}

describe('non-wedding events', { skip: liveBook }, () => {
  it('book under one contact name, as a Custom event, with no planning portal', async () => {
    setLegacyDateReader(async () => 'open')
    const event = await createBooking({
      ...base,
      partnerOne: 'Dana Quinn',
      partnerTwo: '',
      eventDate: '2029-12-14',
      packageId: 'custom',
      customTotalCents: 90000,
      nonWedding: true,
    })
    assert.equal(event.nonWedding, true)
    assert.equal(event.partnerTwo, '')
    const wedding = await createBooking({
      ...base,
      partnerOne: 'Rae',
      partnerTwo: 'Lee',
      eventDate: '2029-12-15',
      packageId: 'full',
    })
    assert.equal(wedding.nonWedding, false)
    const plans = (await listPlanProgress()).map((row) => row.bookingId)
    const contacts = (await listPlanContacts()).map((row) => row.bookingId)
    assert.equal(plans.includes(event.id), false)
    assert.equal(contacts.includes(event.id), false)
    assert.equal(plans.includes(wedding.id), true)
    assert.equal(contacts.includes(wedding.id), true)

    // An edit that does not mention the flag keeps it, and the one name.
    const edited = await updateBooking({
      ...base,
      id: event.id,
      partnerOne: 'Dana Quinn',
      partnerTwo: '',
      eventDate: '2029-12-14',
      packageId: 'custom',
      customTotalCents: 90000,
      notes: 'Office party',
    })
    assert.equal(edited.nonWedding, true)

    // A wedding still needs both names.
    await assert.rejects(
      () => createBooking({ ...base, partnerOne: 'Solo', partnerTwo: '', eventDate: '2029-12-16', packageId: 'full' }),
      /second name/,
    )
  })
})

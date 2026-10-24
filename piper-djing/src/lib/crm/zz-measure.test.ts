// Temporary: counts Book calls for Desk saves and reloads, reported as a failure message.
import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { takeBookCalls } from '../db.server.ts'
import {
  addPayment,
  createBooking,
  listBookings,
  listExternalDates,
  listLeads,
  listMedia,
  listPackageOffers,
  listPartners,
  listPayments,
  listQuestions,
  listReviews,
  listVenues,
  listBots,
  listPlanProgress,
  sendInvoice,
  updateBooking,
} from './store.server.ts'

const input = {
  partnerOne: 'Measure',
  partnerTwo: 'Calls',
  email: 'measure@example.com',
  phone: '',
  eventDate: '2031-06-14',
  stagDate: null,
  packageId: 'full',
  withStag: false,
  uplights: 0,
  venueKm: [],
  venueName: 'Measure Hall',
  venueStreet: '',
  venueTwoName: '',
  venueTwoStreet: '',
  sample: false,
  notes: '',
}

describe('measure', { concurrency: 1 }, () => {
  it('counts', async () => {
    const out: string[] = []
    const count = async (name: string, fn: () => Promise<unknown>) => {
      takeBookCalls()
      const start = performance.now()
      await fn()
      out.push(`${name}=${takeBookCalls()} (${Math.round(performance.now() - start)}ms)`)
    }
    let id = 0
    await count('createBooking cold', async () => { id = (await createBooking(input)).id })
    await count('createBooking warm', async () => { await createBooking({ ...input, partnerOne: 'Measure2', eventDate: '2031-06-21' }) })
    await count('updateBooking', () => updateBooking({ ...input, id, notes: 'x' }))
    await count('updateBooking again', () => updateBooking({ ...input, id, notes: 'y' }))
    await count('sendInvoice', () => sendInvoice(id))
    await count('addPayment', () => addPayment(id, 10_000, 'deposit'))
    await count('listBookings', () => listBookings())
    await count('getDesk lists', () => Promise.all([
      listBookings(), listPayments(), listLeads(), listExternalDates(), listQuestions(),
      listMedia(), listPartners(), listReviews(), listBots(), listPackageOffers(), listVenues(),
    ]).then(() => listPlanProgress()))
    assert.fail(`CALLS ${out.join(' | ')}`)
  })
})

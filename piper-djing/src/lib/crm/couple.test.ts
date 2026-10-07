import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { coupleBySlug, createBooking, sendInvoice } from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('couple portal', { skip: liveBook }, () => {
  it('shows the date and the invoice without streets', async () => {
    const booking = await createBooking({
      partnerOne: 'Nora',
      partnerTwo: 'Ellis',
      email: 'nora@example.com',
      phone: '',
      eventDate: '2028-05-02',
      stagDate: '2028-04-18',
      packageId: 'full',
      withStag: true,
      uplights: 0,
      venueKm: [12],
      venueName: 'The Hall',
      venueStreet: '12 Chapel Lane',
      venueTwoName: 'The Barn',
      venueTwoStreet: '4 Mill Road',
      sample: true,
      notes: '39 Butcher Crescent stays off the page.',
    })
    const page = await coupleBySlug(booking.slug)
    assert.ok(page)
    assert.equal(page.venueName, 'The Hall')
    assert.equal(page.venueTwoName, 'The Barn')
    assert.equal(page.invoiceSlug, booking.invoice?.slug)
    const printed = JSON.stringify(page)
    assert.doesNotMatch(printed, /Chapel/)
    assert.doesNotMatch(printed, /Mill Road/)
    assert.doesNotMatch(printed, /Butcher/)
    assert.equal(page.status, 'open')

    await sendInvoice(booking.id)
    const held = await coupleBySlug(booking.slug)
    assert.ok(held)
    assert.equal(held.status, 'hold')
    assert.ok(held.holdStartedOn)
    assert.ok(held.holdLastDay)
    assert.equal(held.invoiceStatus, 'sent')
  })
})

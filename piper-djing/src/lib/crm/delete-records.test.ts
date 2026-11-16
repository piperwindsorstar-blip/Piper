import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deskBotResponse } from '../bots/desk-rest.server.ts'
import { query } from '../db.server.ts'
import { setLegacyDateReader } from '../legacy-book.server.ts'
import { SAVED_WEDDINGS } from './booking-rules.ts'
import {
  bookExternalDate,
  countedTotal,
  createBooking,
  createInquiry,
  dateOpen,
  inviteBot,
  listBookings,
  listExternalDates,
  listLeads,
  listPayments,
  removeBooking,
  removeExternalDate,
  removeLead,
} from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const blank = {
  phone: '',
  stagDate: null,
  packageId: 'full',
  withStag: false,
  uplights: 0,
  venueKm: [],
  venueName: 'Hall',
  venueStreet: '1 Main',
  venueTwoName: '',
  venueTwoStreet: '',
  sample: false,
  notes: '',
}

describe('deleting a booking or inquiry', { skip: liveBook }, () => {
  it('removes the booking, invoice, payments, and emails, and opens the date', async () => {
    setLegacyDateReader(async () => 'open')
    const booking = await createBooking({
      ...blank,
      partnerOne: 'Nina',
      partnerTwo: 'Omar',
      email: 'nina@example.com',
      eventDate: '2028-04-04',
    })
    assert.ok(booking.invoice)
    await query('UPDATE bookings SET status = $1 WHERE id = $2', [
      'booked',
      booking.id,
    ])
    await query(
      'INSERT INTO payments (invoice_id, cents, note) VALUES ($1, $2, $3)',
      [booking.invoice.id, 50000, 'Deposit'],
    )
    await query(
      `INSERT INTO emails (booking_id, kind, to_address, subject, body, delivered, detail)
       VALUES ($1, 'invoice', $2, 'Invoice', 'Balance due', false, '')`,
      [booking.id, 'nina@example.com'],
    )
    assert.equal(await dateOpen('2028-04-04'), false)
    await removeBooking(booking.id)
    assert.equal(await dateOpen('2028-04-04'), true)
    assert.equal(
      (await listBookings()).some((row) => row.id === booking.id),
      false,
    )
    assert.equal(
      (await listPayments()).some((row) => row.bookingId === booking.id),
      false,
    )
    const invoices = await query<{ id: number }>(
      'SELECT id FROM invoices WHERE booking_id = $1',
      [booking.id],
    )
    const emails = await query<{ id: number }>(
      'SELECT id FROM emails WHERE booking_id = $1',
      [booking.id],
    )
    assert.equal(invoices.length, 0)
    assert.equal(emails.length, 0)
    await assert.rejects(() => removeBooking(booking.id), /not on the book/)
  })

  it('keeps a deleted saved wedding deleted and opens that date', async () => {
    setLegacyDateReader(async () => 'open')
    const cobi = SAVED_WEDDINGS.find((wedding) => wedding.partnerOne === 'Cobi')
    assert.ok(cobi)
    const first = await listBookings()
    const row = first.find((booking) => booking.eventDate === cobi.date)
    assert.ok(row)
    assert.equal(await dateOpen(cobi.date), false)
    const before = await countedTotal()
    await removeBooking(row.id)
    const second = await listBookings()
    assert.equal(
      second.some((booking) => booking.eventDate === cobi.date),
      false,
    )
    assert.equal(await dateOpen(cobi.date), true)
    assert.equal(await countedTotal(), before - cobi.totalCents)
    assert.equal(
      (await listPayments()).some((payment) => payment.bookingId === row.id),
      false,
    )
    const kevin = SAVED_WEDDINGS.find(
      (wedding) => wedding.partnerOne === 'Kevin',
    )
    assert.ok(kevin)
    assert.equal(await dateOpen(kevin.date), false)
    const again = await createBooking({
      ...blank,
      partnerOne: cobi.partnerOne,
      partnerTwo: cobi.partnerTwo,
      email: 'cobi@example.com',
      eventDate: cobi.date,
      venueName: cobi.venueName,
    })
    assert.equal(again.totalCents, cobi.totalCents)
    assert.equal(again.depositCents, cobi.depositClearedCents)
    await removeBooking(again.id)
    const third = await listBookings()
    assert.equal(
      third.some(
        (booking) =>
          booking.eventDate === cobi.date &&
          booking.partnerOne === cobi.partnerOne,
      ),
      false,
    )
    assert.equal(await dateOpen(cobi.date), true)
  })

  it('deletes an inquiry without removing its booking', async () => {
    setLegacyDateReader(async () => 'open')
    const filed = await createInquiry({
      partnerOne: 'Quinn',
      partnerTwo: 'Reed',
      email: 'quinn@example.com',
      phone: '',
      eventDate: '2028-04-05',
      packageId: 'full',
      withStag: false,
      stagDate: null,
      message: 'Evening only',
    })
    assert.equal(filed.ok, true)
    const lead = (await listLeads()).find(
      (item) => item.email === 'quinn@example.com',
    )
    const booking = (await listBookings()).find(
      (item) => item.email === 'quinn@example.com',
    )
    assert.ok(lead)
    assert.ok(booking)
    await removeLead(lead.id)
    assert.equal(
      (await listLeads()).some((item) => item.id === lead.id),
      false,
    )
    assert.ok((await listBookings()).some((item) => item.id === booking.id))
    await removeBooking(booking.id)
    assert.equal(
      (await listBookings()).some((item) => item.id === booking.id),
      false,
    )
    assert.equal(
      (await listLeads()).some((item) => item.email === 'quinn@example.com'),
      false,
    )
  })

  it('removes an external date and lets a writer delete a booking', async () => {
    setLegacyDateReader(async () => 'open')
    const external = await bookExternalDate({
      eventDate: '2028-04-06',
      kind: 'event',
      company: 'Northstar Events',
      label: 'Staff party',
      notes: '',
    })
    assert.equal(await dateOpen('2028-04-06'), false)
    await removeExternalDate(external.id)
    assert.equal(await dateOpen('2028-04-06'), true)
    assert.equal(
      (await listExternalDates()).some((row) => row.id === external.id),
      false,
    )
    const booking = await createBooking({
      ...blank,
      partnerOne: 'Sam',
      partnerTwo: 'Jules',
      email: 'sam@example.com',
      eventDate: '2028-04-07',
    })
    const writer = await inviteBot('Delete Writer', 'writer')
    const removed = await deskBotResponse(
      new Request(`http://localhost/api/bots/v1/bookings/${booking.id}`, {
        method: 'DELETE',
        headers: { authorization: `Bearer ${writer.token}` },
      }),
      async () => 'no',
    )
    assert.equal(removed.status, 200)
    assert.equal(
      (await listBookings()).some((row) => row.id === booking.id),
      false,
    )
    assert.equal(await dateOpen('2028-04-07'), true)
  })
})

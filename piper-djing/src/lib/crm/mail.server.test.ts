import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { handleBot } from '../bots/handle.server.ts'
import { createBooking, inviteBot, updateBooking } from './store.server.ts'
import { listEmails, mailStatus } from './mail.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

async function post(
  token: string,
  body: Record<string, unknown>,
): Promise<Response> {
  return handleBot(
    new Request('http://localhost/api/bots/v1', {
      method: 'POST',
      headers: {
        authorization: `Bearer ${token}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify(body),
    }),
  )
}

describe('bot emails', { skip: liveBook }, () => {
  it('lets a writer save a letter and keeps a reader from sending', async () => {
    process.env.PIPER_SMTP_PASS = 'app-password'
    delete process.env.PIPER_SMTP_HOST
    delete process.env.PIPER_SMTP_USER
    const status = mailStatus()
    delete process.env.PIPER_SMTP_PASS
    assert.equal(status.ready, true)
    assert.equal(status.from, 'Piper DJing <PiperPWeddingDJ@gmail.com>')

    const reader = await inviteBot('Reader', 'reader')
    const writer = await inviteBot('Writer', 'writer')
    const booking = await createBooking({
      partnerOne: 'Nora',
      partnerTwo: 'Ellis',
      email: '',
      phone: '',
      eventDate: '2028-04-14',
      stagDate: null,
      packageId: 'reception',
      withStag: false,
      uplights: 0,
      venueKm: [12],
      venueName: 'The Hall',
      venueStreet: '12 Chapel Lane',
      venueTwoName: '',
      venueTwoStreet: '',
      sample: true,
      notes: 'Home base 39 Butcher Crescent stays off the letter.',
    })

    const denied = await post(reader.token, {
      action: 'email_booking',
      bookingId: booking.id,
    })
    assert.equal(denied.status, 403)
    assert.match((await denied.json()).error, /can read/)

    const missing = await post(writer.token, {
      action: 'email_booking',
      bookingId: booking.id,
    })
    assert.equal(missing.status, 400)
    assert.match((await missing.json()).error, /no email address/)

    await updateBooking({
      id: booking.id,
      partnerOne: booking.partnerOne,
      partnerTwo: booking.partnerTwo,
      email: 'nora@example.com',
      phone: booking.phone,
      eventDate: booking.eventDate,
      stagDate: booking.stagDate,
      packageId: booking.packageId,
      withStag: booking.withStag,
      uplights: booking.uplights,
      venueKm: booking.venueKm,
      venueName: booking.venueName,
      venueStreet: booking.venueStreet,
      venueTwoName: booking.venueTwoName,
      venueTwoStreet: booking.venueTwoStreet,
      sample: booking.sample,
      notes: booking.notes,
    })

    const sent = await post(writer.token, {
      action: 'email_booking',
      bookingId: booking.id,
    })
    assert.equal(sent.status, 200)
    const sentBody = (await sent.json()) as {
      delivered: boolean
      detail: string
    }
    assert.equal(sentBody.delivered, false)
    assert.match(sentBody.detail, /not sent/)

    const invoiced = await post(writer.token, {
      action: 'email_invoice',
      bookingId: booking.id,
    })
    assert.equal(invoiced.status, 200)
    const invoicedBody = (await invoiced.json()) as { delivered: boolean }
    assert.equal(invoicedBody.delivered, false)

    const listed = await handleBot(
      new Request('http://localhost/api/bots/v1?resource=emails', {
        headers: { authorization: `Bearer ${reader.token}` },
      }),
    )
    assert.equal(listed.status, 200)
    const emails = (
      (await listed.json()) as {
        emails: { kind: string; to: string; body: string; delivered: boolean }[]
      }
    ).emails
    assert.equal(emails.length, 2)
    assert.equal(emails[0]?.kind, 'invoice')
    assert.equal(emails[1]?.kind, 'booking')
    for (const email of emails) {
      assert.equal(email.to, 'nora@example.com')
      assert.equal(email.delivered, false)
      assert.match(email.body, /TEST/)
      assert.doesNotMatch(email.body, /Chapel/)
      assert.doesNotMatch(email.body, /Butcher/)
      if (email.kind === 'booking') assert.match(email.body, /The Hall/)
    }
    assert.equal((await listEmails()).length, 2)
  })
})

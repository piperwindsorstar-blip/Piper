import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { deskBotResponse } from '../bots/desk-rest.server.ts'
import { setLegacyDateReader } from '../legacy-book.server.ts'
import {
  bookExternalDate,
  countedTotal,
  createBooking,
  dateOpen,
  inviteBot,
  listExternalDates,
  releaseExternalDate,
} from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const freelance = {
  eventDate: '2028-11-14',
  kind: 'wedding',
  company: 'Northstar Events',
  label: 'Sam and Jules',
  notes: 'Ceremony and reception',
}

describe('external dates', { skip: liveBook }, () => {
  it('books a freelance wedding and event without an invoice', async () => {
    setLegacyDateReader(async () => 'open')
    const before = await countedTotal()
    const wedding = await bookExternalDate(freelance)
    assert.equal(wedding.kind, 'wedding')
    assert.equal(wedding.company, 'Northstar Events')
    assert.equal(wedding.released, false)
    assert.equal(await dateOpen('2028-11-14'), false)
    const party = await bookExternalDate({
      eventDate: '2028-11-15',
      kind: 'event',
      company: 'Harbour Hall',
      label: 'Staff party',
      notes: '',
    })
    assert.equal(party.kind, 'event')
    assert.equal(await dateOpen('2028-11-15'), false)
    await assert.rejects(
      () =>
        bookExternalDate({
          ...freelance,
          company: 'Other Co',
        }),
      /already held/,
    )
    await assert.rejects(
      () =>
        createBooking({
          partnerOne: 'Ada',
          partnerTwo: 'Bo',
          email: 'ada@example.com',
          phone: '',
          eventDate: '2028-11-15',
          stagDate: null,
          packageId: 'full',
          withStag: false,
          uplights: 0,
          venueKm: [],
          venueName: '',
          venueStreet: '',
          venueTwoName: '',
          venueTwoStreet: '',
          sample: false,
          notes: '',
        }),
      /already held/,
    )
    assert.equal(await countedTotal(), before)
    const listed = await listExternalDates()
    assert.equal(
      listed.filter((row) => row.eventDate.startsWith('2028-11-1')).length,
      2,
    )
    const released = await releaseExternalDate(wedding.id)
    assert.equal(released.released, true)
    const again = await releaseExternalDate(wedding.id)
    assert.equal(again.released, true)
    assert.equal(await dateOpen('2028-11-14'), true)
    assert.equal(await dateOpen('2028-11-15'), false)
  })

  it('refuses the blocked day, a saved wedding, a blank company, and an unknown kind', async () => {
    setLegacyDateReader(async () => 'open')
    await assert.rejects(
      () =>
        bookExternalDate({
          ...freelance,
          eventDate: '2027-02-20',
        }),
      /20 February 2027 is not booked/,
    )
    await assert.rejects(
      () =>
        bookExternalDate({
          ...freelance,
          eventDate: '2027-07-17',
        }),
      /already held/,
    )
    await assert.rejects(
      () =>
        bookExternalDate({
          ...freelance,
          eventDate: '2028-11-20',
          kind: 'party',
        }),
      /Choose a wedding or an event/,
    )
    await assert.rejects(
      () =>
        bookExternalDate({
          ...freelance,
          eventDate: '2028-11-20',
          company: '   ',
        }),
      /The company is required/,
    )
  })

  it('lets a writer book and release an external date', async () => {
    setLegacyDateReader(async () => 'open')
    const reader = await inviteBot('External Reader', 'reader')
    const writer = await inviteBot('External Writer', 'writer')
    const denied = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/externals', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${reader.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          eventDate: '2028-12-01',
          kind: 'event',
          company: 'Reader Co',
        }),
      }),
      async () => 'no',
    )
    assert.equal(denied.status, 403)
    const saved = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/externals', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${writer.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          eventDate: '2028-12-01',
          kind: 'event',
          company: 'Writer Co',
          name: 'Holiday party',
        }),
      }),
      async () => 'no',
    )
    assert.equal(saved.status, 200)
    const body = (await saved.json()) as {
      external: { id: number; label: string; released: boolean }
    }
    assert.equal(body.external.label, 'Holiday party')
    assert.equal(body.external.released, false)
    assert.equal(await dateOpen('2028-12-01'), false)
    const removed = await deskBotResponse(
      new Request(
        `http://localhost/api/bots/v1/externals/${body.external.id}`,
        {
          method: 'DELETE',
          headers: { authorization: `Bearer ${writer.token}` },
        },
      ),
      async () => 'no',
    )
    assert.equal(removed.status, 405)
    assert.equal(await dateOpen('2028-12-01'), false)
    const released = await deskBotResponse(
      new Request(
        `http://localhost/api/bots/v1/externals/${body.external.id}`,
        {
          method: 'PATCH',
          headers: {
            authorization: `Bearer ${writer.token}`,
            'content-type': 'application/json',
          },
          body: JSON.stringify({ released: true }),
        },
      ),
      async () => 'no',
    )
    assert.equal(released.status, 200)
    const after = (await released.json()) as {
      external: { released: boolean }
    }
    assert.equal(after.external.released, true)
    assert.equal(await dateOpen('2028-12-01'), true)
    const stayed = await releaseExternalDate(body.external.id)
    assert.equal(stayed.released, true)
  })
})

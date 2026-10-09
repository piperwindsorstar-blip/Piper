import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createBooking,
  coupleBySlug,
  saveCouplePlanning,
} from './store.server.ts'
import { TIMELINE } from './planning.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('planning form', { skip: liveBook }, () => {
  it('gives each couple a blank copy and keeps the venue street off it', async () => {
    const booking = await createBooking({
      partnerOne: 'Nora',
      partnerTwo: 'Ellis',
      email: 'nora@example.com',
      phone: '555-0100',
      eventDate: '2028-08-12',
      stagDate: null,
      packageId: 'reception',
      withStag: false,
      uplights: 0,
      venueKm: [],
      venueName: 'The Hall',
      venueStreet: '12 Chapel Lane',
      venueTwoName: '',
      venueTwoStreet: '',
      sample: true,
      notes: '39 Butcher Crescent stays off the page.',
    })
    const page = await coupleBySlug(booking.slug)
    assert.ok(page)
    assert.equal(page.planningSaved, false)
    assert.equal(page.planning.coupleNames, 'Nora and Ellis')
    assert.equal(page.planning.email, 'nora@example.com')
    assert.equal(page.planning.venueName, 'The Hall')
    assert.equal(page.planning.ceremonyAddress, '')
    assert.equal(page.planning.timeline.length, TIMELINE.length)
    assert.equal(page.planning.timeline[8]?.activity, 'First dance')
    const printed = JSON.stringify(page.planning)
    assert.doesNotMatch(printed, /Chapel/)
    assert.doesNotMatch(printed, /Butcher/)

    const saved = await saveCouplePlanning(booking.slug, {
      ...page.planning,
      mustPlay: 'At Last',
      tableForDj: 'Yes',
      ceremonyAddress: '12 Chapel Lane',
      timeline: page.planning.timeline.map((row, index) =>
        index === 8 ? { ...row, song: 'At Last', artist: 'Etta James' } : row,
      ),
    })
    assert.equal(saved.mustPlay, 'At Last')
    assert.equal(saved.tableForDj, 'Yes')
    assert.equal(saved.timeline[8]?.song, 'At Last')
    assert.equal(saved.timeline[8]?.activity, 'First dance')

    const again = await coupleBySlug(booking.slug)
    assert.ok(again)
    assert.equal(again.planningSaved, true)
    assert.equal(again.planning.mustPlay, 'At Last')
    assert.equal(again.planning.tableForDj, 'Yes')
    await assert.rejects(
      () => saveCouplePlanning('missing-page', { mustPlay: 'Nope' }),
      /not found/,
    )
  })
})

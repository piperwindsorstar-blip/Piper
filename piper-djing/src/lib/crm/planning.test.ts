import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  createBooking,
  coupleBySlug,
  lockCouplePlan,
  saveCouplePlanning,
  savePortalDeskFields,
} from './store.server.ts'
import {
  TIMELINE,
  blankPlanning,
  isPlanLocked,
  mergeCoupleSave,
  planningFromUnknown,
} from './planning.ts'

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
    assert.equal(page.planning.timeline[0]?.activity, 'Guest arrival & seating')
    assert.equal(page.planning.timeline[4]?.activity, 'Recessional')
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
    assert.equal(saved.planLocked, false)

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

  it('locks a sent plan and a past finish-by date', async () => {
    const booking = await createBooking({
      partnerOne: 'Nora',
      partnerTwo: 'Ellis',
      email: 'nora-lock@example.com',
      phone: '555-0101',
      eventDate: '2028-09-12',
      stagDate: null,
      packageId: 'reception',
      withStag: false,
      uplights: 0,
      venueKm: [],
      venueName: 'The Hall',
      venueStreet: '',
      venueTwoName: '',
      venueTwoStreet: '',
      sample: true,
      notes: '',
    })
    const page = await coupleBySlug(booking.slug)
    assert.ok(page)
    const locked = await lockCouplePlan(booking.slug)
    assert.equal(locked.planLocked, true)
    await assert.rejects(
      () =>
        saveCouplePlanning(booking.slug, {
          ...page.planning,
          mustPlay: 'Nope',
        }),
      /locked/,
    )
    const opened = await savePortalDeskFields(booking.slug, {
      arrivalTime: '3:00 pm',
      dueDate: '',
      unlock: true,
    })
    assert.equal(opened.planLocked, false)
    assert.equal(opened.arrivalTime, '3:00 pm')
    const dated = await savePortalDeskFields(booking.slug, {
      arrivalTime: '3:00 pm',
      dueDate: '2020-01-01',
      unlock: false,
    })
    assert.equal(dated.dueDate, '2020-01-01')
    await assert.rejects(
      () => saveCouplePlanning(booking.slug, dated),
      /locked/,
    )
  })
})

describe('planning values', () => {
  const seed = {
    coupleNames: 'Ada and Lin',
    email: 'ada@example.com',
    phone: '555',
    weddingDate: '14 June 2028',
    venueName: 'The Hall',
  }

  it('keeps DJ fields on the couple save and moves a pasted link out of notes', () => {
    const existing = blankPlanning(seed)
    const incoming = {
      ...existing,
      planLocked: true,
      dueDate: '2020-01-01',
      djName: 'Someone else',
      arrivalTime: '9:00',
      mustPlay: 'Stay',
    }
    const merged = mergeCoupleSave(existing, incoming)
    assert.equal(merged.planLocked, false)
    assert.equal(merged.dueDate, '')
    assert.equal(merged.djName, '')
    assert.equal(merged.arrivalTime, '')
    assert.equal(merged.mustPlay, 'Stay')
    assert.equal(
      isPlanLocked({ ...existing, dueDate: '2020-01-01' }, '2026-10-11'),
      true,
    )
    assert.equal(
      isPlanLocked({ ...existing, dueDate: '2026-10-11' }, '2026-10-11'),
      false,
    )
    const parsed = planningFromUnknown(
      {
        timeline: [
          { notes: 'https://open.spotify.com/track/abc', song: 'At Last' },
        ],
      },
      seed,
    )
    assert.equal(parsed.timeline[0]?.link, 'https://open.spotify.com/track/abc')
    assert.equal(parsed.timeline[0]?.notes, '')
    assert.equal(parsed.timeline[0]?.song, 'At Last')
    assert.equal(parsed.timeline[0]?.activity, 'Guest arrival & seating')
    assert.equal(parsed.timeline.length, TIMELINE.length)
  })
})

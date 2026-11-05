import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  coupleByPasscode,
  createBooking,
  listCouplePortals,
  lockCouplePlan,
  saveCouplePasscode,
  saveCouplePlanning,
  saveDeskPlanning,
  savePortalMaster,
} from '../crm/store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('desk portals', { skip: liveBook }, () => {
  it('edits a locked plan, fills a passcode, and keeps the code off the couple save', async () => {
    const booking = await createBooking({
      partnerOne: 'Portal',
      partnerTwo: 'Desk',
      email: 'portal-desk@example.com',
      phone: '555-0199',
      eventDate: '2031-04-04',
      stagDate: null,
      packageId: 'reception',
      withStag: false,
      uplights: 0,
      venueKm: [],
      venueName: 'The Test Hall',
      venueStreet: '',
      venueTwoName: '',
      venueTwoStreet: '',
      sample: true,
      notes: '',
    })
    const locked = await lockCouplePlan(booking.slug)
    const saved = await saveDeskPlanning(booking.slug, {
      ...locked,
      lastName: 'Desk',
    })
    assert.equal(saved.lastName, 'Desk')
    assert.equal(saved.planLocked, true)
    await assert.rejects(
      () => saveCouplePlanning(booking.slug, { ...saved, lastName: 'Couple' }),
      /locked/,
    )
    const listed = await listCouplePortals()
    const row = listed.portals.find((portal) => portal.slug === booking.slug)
    assert.ok(row)
    assert.match(row.passcode, /^[A-Z0-9]{6}$/)
    assert.equal(await coupleByPasscode(row.passcode), booking.slug)
    await assert.rejects(
      () => saveCouplePasscode(booking.slug, 'NO'),
      /4 to 12/,
    )
    const other = listed.portals.find((portal) => portal.slug !== booking.slug)
    if (other) {
      await assert.rejects(
        () => saveCouplePasscode(booking.slug, other.passcode),
        /already in use/,
      )
    }
    const renamed = await saveCouplePasscode(booking.slug, 'plan4')
    assert.equal(renamed, 'PLAN4')
    await saveCouplePlanning(booking.slug, saved).catch(() => undefined)
    const after = await listCouplePortals()
    const again = after.portals.find((portal) => portal.slug === booking.slug)
    assert.equal(again?.passcode, 'PLAN4')
    await savePortalMaster({ guestCount: { hidden: true } })
    const mastered = await listCouplePortals()
    const hidden = mastered.portals.find(
      (portal) => portal.slug === booking.slug,
    )
    assert.ok(hidden)
    assert.ok(hidden.total < row.total)
    await savePortalMaster({})
  })
})

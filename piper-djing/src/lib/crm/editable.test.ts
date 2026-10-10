import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { recordMoney } from './booking-rules.ts'
import type { BookingState, InvoiceState } from './booking-rules.ts'
import {
  addQuestion,
  deskProfile,
  inviteBot,
  listPackageOffers,
  listQuestions,
  removeQuestion,
  saveDeskProfile,
  updatePackageOffer,
  updateQuestion,
} from './store.server.ts'
import { quote } from '../piper/rules.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('stored package prices', () => {
  it('quotes from the prices it is given and keeps the defaults', () => {
    assert.equal(
      quote({ packageId: 'full', withStag: false, uplights: 0, venueKm: [] })
        .totalCents,
      165000,
    )
    const custom = quote(
      { packageId: 'ceremony', withStag: false, uplights: 0, venueKm: [] },
      { full: 165000, reception: 155000, stag: 70000, ceremony: 40000 },
    )
    assert.equal(custom.totalCents, 40000)
    assert.equal(custom.depositCents, 40000)
  })

  it('requires the higher ceremony price before a hold becomes booked', () => {
    const booking: BookingState = {
      partnerOne: 'Alex',
      partnerTwo: 'Jordan',
      eventDate: '2028-08-14',
      stagDate: null,
      packageId: 'ceremony',
      withStag: false,
      uplights: 0,
      venueKm: [],
      venueName: 'The Hall',
      venueStreet: '1 King Street',
      sample: true,
      status: 'hold',
      totalCents: 35000,
      depositCents: 35000,
      holdStartedOn: '2026-10-01',
      stagReleased: false,
    }
    const invoice: InvoiceState = {
      status: 'sent',
      totalCents: 35000,
      depositCents: 35000,
      receivedCents: 0,
    }
    const short = recordMoney(booking, invoice, 35000, 40000)
    assert.equal(short.newlyBooked, false)
    assert.equal(short.booking.status, 'hold')
    const covered = recordMoney(booking, invoice, 40000, 40000)
    assert.equal(covered.newlyBooked, true)
    assert.equal(covered.booking.status, 'booked')
  })
})

describe('desk edits', { skip: liveBook }, () => {
  it('saves a package price, a question, and the desk profile', async () => {
    const before = await listPackageOffers()
    assert.equal(before.find((item) => item.id === 'full')?.cents, 165000)
    const saved = await updatePackageOffer({
      id: 'full',
      name: 'Full wedding day',
      detail: before.find((item) => item.id === 'full')?.detail ?? 'Day',
      cents: 170000,
    })
    assert.equal(saved.cents, 170000)
    assert.equal(
      (await listPackageOffers()).find((item) => item.id === 'reception')
        ?.cents,
      155000,
    )

    await addQuestion('Where do you set up?')
    const questions = await listQuestions()
    const question = questions.find(
      (item) => item.prompt === 'Where do you set up?',
    )
    assert.ok(question)
    const edited = await updateQuestion(question.id, 'Where does the booth go?')
    assert.equal(edited.prompt, 'Where does the booth go?')
    await removeQuestion(question.id)
    assert.equal(
      (await listQuestions()).some((item) => item.id === question.id),
      false,
    )

    const profile = await deskProfile()
    assert.match(profile.email, /@/)
    const next = await saveDeskProfile({
      email: 'piper@example.com',
      homeBase: '39 Butcher Crescent',
    })
    assert.equal(next.email, 'piper@example.com')
    await inviteBot('Editor', 'writer')
  })
})

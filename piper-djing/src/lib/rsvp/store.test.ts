import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addPayment,
  countedTotal,
  createBooking,
  removeBooking,
  sendInvoice,
} from '../crm/store.server.ts'
import { PIPER_RSVP_CENTS, STANDALONE_RSVP_CENTS } from './model.ts'
import {
  createRsvpWedding,
  deleteRsvp,
  quoteRsvpPrice,
  readRsvp,
  readRsvpPhoto,
  removeRsvpPhoto,
  saveRsvpPhoto,
} from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const bookingInput = {
  partnerOne: 'Rsvp',
  partnerTwo: 'Trial',
  email: 'paid-rsvp@example.com',
  phone: '555-0100',
  eventDate: '2030-04-04',
  stagDate: null,
  packageId: 'reception',
  withStag: false,
  uplights: 0,
  venueKm: [],
  venueName: 'The Hall',
  venueStreet: '1 Test Lane',
  venueTwoName: '',
  venueTwoStreet: '',
  sample: false,
  notes: '',
}

describe('rsvp store', { skip: liveBook }, () => {
  it('makes a paid booking free and leaves the counted book unchanged', async () => {
    const before = await countedTotal()
    const alone = await quoteRsvpPrice('nobody-rsvp@example.com')
    assert.equal(alone.cents, STANDALONE_RSVP_CENTS)
    const booking = await createBooking(bookingInput)
    assert.equal(
      (await quoteRsvpPrice('paid-rsvp@example.com')).cents,
      STANDALONE_RSVP_CENTS,
    )
    await sendInvoice(booking.id)
    await addPayment(booking.id, 40_000, 'deposit')
    const paid = await quoteRsvpPrice('paid-rsvp@example.com')
    assert.equal(paid.cents, PIPER_RSVP_CENTS)
    assert.equal(paid.kind, 'piper')
    const created = await createRsvpWedding({
      partnerOne: 'Ada',
      partnerTwo: 'Lane',
      email: 'paid-rsvp@example.com',
      eventDate: '2030-08-08',
      venue: 'The Hall',
    })
    assert.equal(created.priceCents, PIPER_RSVP_CENTS)
    assert.equal(created.paid, true)
    assert.equal(created.replyEmail, 'paid-rsvp@example.com')
    assert.equal((await readRsvp(created.slug))?.email, 'paid-rsvp@example.com')
    await deleteRsvp(created.slug)
    await removeBooking(booking.id)
    assert.equal(await countedTotal(), before)
  })
})

describe('the couple photo store', { skip: liveBook }, () => {
  it('keeps a 400 KB photo in rows and hands it back whole', async () => {
    const wedding = await createRsvpWedding({
      partnerOne: 'Photo',
      partnerTwo: 'Trial',
      email: 'photo-rsvp@example.com',
      eventDate: '2030-09-09',
      venue: 'The Hall',
    })
    const bytes = new Uint8Array(400_000)
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (index * 13) % 256
    }
    const photo = await saveRsvpPhoto({
      slug: wedding.slug,
      mime: 'image/jpeg',
      bytes,
      width: 1080,
      height: 1920,
    })
    assert.equal(photo.bytes, 400_000)
    assert.equal(photo.width, 1080)
    assert.equal(photo.height, 1920)
    // the record is the whole photo and nothing else: no shape, no crop
    assert.deepEqual(Object.keys(photo).sort(), [
      'bytes',
      'height',
      'version',
      'width',
    ])

    const back = await readRsvpPhoto(wedding.slug)
    if (!back) throw new Error('the photo should be there')
    assert.equal(back.mime, 'image/jpeg')
    assert.equal(back.version, photo.version)
    assert.equal(back.bytes.length, bytes.length)
    assert.deepEqual(back.bytes.slice(0, 64), bytes.slice(0, 64))
    assert.deepEqual(back.bytes.slice(-64), bytes.slice(-64))

    // a second upload replaces the first, and the version moves with it
    const second = await saveRsvpPhoto({
      slug: wedding.slug,
      mime: 'image/jpeg',
      bytes: new Uint8Array(1000).fill(7),
      width: 1000,
      height: 1250,
    })
    assert.notEqual(second.version, photo.version)
    const replaced = await readRsvpPhoto(wedding.slug)
    assert.equal(replaced === null ? 0 : replaced.bytes.length, 1000)
    assert.equal(replaced === null ? 0 : replaced.bytes[999], 7)
    assert.equal(replaced === null ? 0 : replaced.version, second.version)

    await removeRsvpPhoto(wedding.slug)
    assert.equal(await readRsvpPhoto(wedding.slug), null)

    await deleteRsvp(wedding.slug)
  })

  it('takes the photo with the RSVP when the wedding is deleted', async () => {
    const wedding = await createRsvpWedding({
      partnerOne: 'Remove',
      partnerTwo: 'Trial',
      email: 'remove-rsvp@example.com',
      eventDate: '2030-10-10',
      venue: 'The Hall',
    })
    await saveRsvpPhoto({
      slug: wedding.slug,
      mime: 'image/jpeg',
      bytes: new Uint8Array(2048),
      width: 1200,
      height: 900,
    })
    assert.ok(await readRsvpPhoto(wedding.slug))
    await deleteRsvp(wedding.slug)
    assert.equal(await readRsvpPhoto(wedding.slug), null)
  })
})

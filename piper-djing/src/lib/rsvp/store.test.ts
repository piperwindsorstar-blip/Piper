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
  readRsvpPhotoCrop,
  readRsvpPhotoMeta,
  removeRsvpPhoto,
  saveRsvpPhoto,
  saveRsvpPhotoCrop,
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
  it('prices a paid booking at $20 and leaves the counted book unchanged', async () => {
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
    assert.equal(created.paid, false)
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
      shape: 'circle',
      width: 1000,
      height: 1000,
      crop: { zoom: 1.4, panX: -0.3, panY: 0.6 },
      cropBytes: new Uint8Array(2048).fill(3),
    })
    assert.equal(photo.bytes, 400_000)
    assert.equal(photo.shape, 'circle')
    assert.deepEqual(photo.crop, { zoom: 1.4, panX: -0.3, panY: 0.6 })
    assert.ok(photo.cropVersion)
    const meta = await readRsvpPhotoMeta(wedding.slug)
    assert.ok(meta && meta.mime === 'image/jpeg' && meta.shape === 'circle')
    assert.equal(meta.width, 1000)
    assert.equal(meta.height, 1000)
    assert.equal(meta.crop.zoom, 1.4)
    assert.equal(meta.crop.panX, -0.3)
    assert.equal(meta.crop.panY, 0.6)
    // the whole photo is kept whole, and the shaped crop sits beside it
    const crop = await readRsvpPhotoCrop(wedding.slug)
    assert.ok(crop)
    assert.equal(crop.shape, 'circle')
    assert.equal(crop.bytes.length, 2048)
    assert.equal(crop.bytes[2047], 3)

    const back = await readRsvpPhoto(wedding.slug)
    const backBytes = back === null ? new Uint8Array() : back.bytes
    assert.equal(backBytes.length, bytes.length)
    assert.equal(back === null ? '' : back.mime, 'image/jpeg')
    assert.deepEqual(backBytes.slice(0, 64), bytes.slice(0, 64))
    assert.deepEqual(backBytes.slice(-64), bytes.slice(-64))

    // a second upload replaces the first, and the version moves with it
    const second = await saveRsvpPhoto({
      slug: wedding.slug,
      mime: 'image/jpeg',
      bytes: new Uint8Array(1000).fill(7),
      shape: 'arch',
      width: 1000,
      height: 1250,
    })
    assert.notEqual(second.version, photo.version)
    // no crop given: the shaped rendition is cleared, not left stale
    assert.equal(second.cropVersion, '')
    assert.equal(await readRsvpPhotoCrop(wedding.slug), null)
    const replaced = await readRsvpPhoto(wedding.slug)
    assert.equal(replaced === null ? 0 : replaced.bytes.length, 1000)
    assert.equal(replaced === null ? 0 : replaced.bytes[999], 7)

    // moving the crop keeps the whole photo exactly as it was
    const moved = await saveRsvpPhotoCrop({
      slug: wedding.slug,
      shape: 'circle',
      crop: { zoom: 2, panX: 0.5, panY: -0.5 },
      cropBytes: new Uint8Array(512).fill(9),
    })
    assert.ok(moved)
    assert.equal(moved.shape, 'circle')
    assert.deepEqual(moved.crop, { zoom: 2, panX: 0.5, panY: -0.5 })
    assert.equal(moved.bytes, 1000)
    const stillWhole = await readRsvpPhoto(wedding.slug)
    assert.equal(stillWhole === null ? 0 : stillWhole.bytes.length, 1000)
    assert.equal(stillWhole === null ? 0 : stillWhole.bytes[999], 7)
    const movedCrop = await readRsvpPhotoCrop(wedding.slug)
    assert.equal(movedCrop === null ? 0 : movedCrop.bytes.length, 512)

    // choosing the whole photo again drops the shaped rendition
    const whole = await saveRsvpPhotoCrop({
      slug: wedding.slug,
      shape: 'full',
      crop: { zoom: 1, panX: 0, panY: 0 },
    })
    assert.ok(whole)
    assert.equal(whole.shape, 'full')
    assert.equal(whole.cropVersion, '')
    assert.equal(await readRsvpPhotoCrop(wedding.slug), null)
    assert.equal(
      (await readRsvpPhoto(wedding.slug))?.bytes.length,
      1000,
      'the whole photo survives a shape change',
    )

    await removeRsvpPhoto(wedding.slug)
    assert.equal(await readRsvpPhoto(wedding.slug), null)
    assert.equal(await readRsvpPhotoMeta(wedding.slug), null)
    assert.equal(await readRsvpPhotoCrop(wedding.slug), null)

    // removing the whole RSVP takes the photo rows with it
    await saveRsvpPhoto({
      slug: wedding.slug,
      mime: 'image/jpeg',
      bytes: new Uint8Array(2048),
      shape: 'banner',
      width: 1200,
      height: 420,
      crop: { zoom: 1, panX: 0, panY: 0 },
      cropBytes: new Uint8Array(256).fill(1),
    })
    await deleteRsvp(wedding.slug)
    assert.equal(await readRsvpPhoto(wedding.slug), null)
    assert.equal(await readRsvpPhotoCrop(wedding.slug), null)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addReview,
  homepageReviews,
  listReviews,
  removeReview,
  setReviewShown,
  updateReview,
} from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const sample = {
  quote: 'The dance floor never stopped.',
  names: 'Alex and Jordan',
  eventType: 'Wedding',
  town: 'Brantford',
  date: '2025-06-14',
  source: 'google',
  show: false,
}

describe('reviews', { skip: liveBook }, () => {
  it('keeps a review off the public pages until it is switched on', async () => {
    assert.deepEqual(await homepageReviews(), [])
    const added = await addReview(sample)
    assert.equal(added.quote, sample.quote)
    assert.equal(added.show, false)
    assert.deepEqual(await homepageReviews(), [])
    const shown = await setReviewShown(added.id, true)
    assert.equal(shown.show, true)
    const publicReviews = await homepageReviews()
    assert.equal(publicReviews.length, 1)
    assert.equal(publicReviews[0]?.names, 'Alex and Jordan')
    assert.equal(publicReviews[0]?.town, 'Brantford')
    assert.equal(publicReviews[0]?.date, '2025-06-14')
    await setReviewShown(added.id, false)
    assert.deepEqual(await homepageReviews(), [])
    await removeReview(added.id)
    assert.deepEqual(await listReviews(), [])
  })

  it('lists switched-on reviews newest first', async () => {
    const older = await addReview({ ...sample, date: '2024-01-02', show: true })
    const newer = await addReview({
      ...sample,
      quote: 'A later night.',
      date: '2025-08-01',
      show: true,
    })
    const hidden = await addReview({
      ...sample,
      quote: 'Hidden.',
      date: '2026-01-01',
      show: false,
    })
    const shown = await homepageReviews()
    assert.deepEqual(
      shown.map((review) => review.quote),
      ['A later night.', sample.quote],
    )
    await removeReview(older.id)
    await removeReview(newer.id)
    await removeReview(hidden.id)
  })

  it('edits a review and allows a blank name', async () => {
    const added = await addReview({ ...sample, names: '' })
    assert.equal(added.names, '')
    const saved = await updateReview(added.id, {
      ...sample,
      quote: 'Updated words.',
      names: '',
      source: 'email',
      show: true,
    })
    assert.equal(saved.quote, 'Updated words.')
    assert.equal(saved.source, 'email')
    assert.equal((await homepageReviews())[0]?.quote, 'Updated words.')
    await removeReview(added.id)
  })

  it('refuses a blank review, a bad date, and an unknown source', async () => {
    await assert.rejects(
      () => addReview({ ...sample, quote: '   ' }),
      /review is required/,
    )
    await assert.rejects(
      () => addReview({ ...sample, date: '' }),
      /date is required/,
    )
    await assert.rejects(
      () => addReview({ ...sample, date: '2025-02-31' }),
      /not valid/,
    )
    await assert.rejects(
      () => addReview({ ...sample, source: 'facebook' }),
      /where the review came from/,
    )
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addReview,
  homepageReviews,
  listReviews,
  removeReview,
  setKindWords,
} from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('reviews', { skip: liveBook }, () => {
  it('keeps a review off the homepage until Kind Words is on', async () => {
    assert.deepEqual(await homepageReviews(), [])
    const added = await addReview({
      quote: 'The dance floor never stopped.',
      names: 'Alex and Jordan',
      when: 'Brantford, 2025',
    })
    assert.equal(added.quote, 'The dance floor never stopped.')
    assert.deepEqual(await homepageReviews(), [])
    assert.equal((await listReviews()).length, 1)
    assert.equal(await setKindWords(true), true)
    const shown = await homepageReviews()
    assert.equal(shown.length, 1)
    assert.equal(shown[0]?.names, 'Alex and Jordan')
    assert.equal(shown[0]?.when, 'Brantford, 2025')
    await removeReview(added.id)
    assert.deepEqual(await listReviews(), [])
    assert.deepEqual(await homepageReviews(), [])
  })

  it('refuses a blank review', async () => {
    await assert.rejects(
      () => addReview({ quote: '   ', names: 'Alex', when: '' }),
      /review is required/,
    )
    await assert.rejects(
      () => addReview({ quote: 'Lovely night.', names: '  ', when: '' }),
      /name is required/,
    )
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  findDuplicateReview,
  parseExternalId,
  parseReviewLink,
  parseStars,
  starsLabel,
} from './reviews.ts'

const saved = [
  { id: 1, names: 'Mark and Mya', source: 'google', date: '2026-09-12', externalId: 'g-abc' },
  { id: 2, names: '', source: 'google', date: '2026-09-12', externalId: '' },
]

describe('review stars, link and externalId', () => {
  it('stars are optional and 1 to 5', () => {
    assert.equal(parseStars(undefined), null)
    assert.equal(parseStars(null), null)
    assert.equal(parseStars(''), null)
    assert.equal(parseStars(5), 5)
    assert.equal(parseStars('4'), 4)
    assert.throws(() => parseStars(6), /1 to 5/)
    assert.throws(() => parseStars(4.5), /1 to 5/)
    assert.throws(() => parseStars('lots'), /1 to 5/)
    assert.equal(starsLabel(4), '4 out of 5 stars')
    assert.equal(starsLabel(null), '')
  })

  it('link must be a web address', () => {
    assert.equal(parseReviewLink(undefined), '')
    assert.equal(parseReviewLink('  '), '')
    assert.equal(
      parseReviewLink('https://g.page/r/abc/review'),
      'https://g.page/r/abc/review',
    )
    assert.throws(() => parseReviewLink('javascript:alert(1)'), /web address/)
    assert.throws(() => parseReviewLink('not a url'), /web address/)
    assert.equal(parseExternalId(' g-1 '), 'g-1')
  })

  it('dedupes by externalId', () => {
    const hit = findDuplicateReview(saved, { names: 'Someone else', source: 'email', date: '2026-01-01', externalId: 'g-abc' })
    assert.equal(hit?.id, 1)
  })

  it('dedupes by names, source and date (names compared loosely)', () => {
    const hit = findDuplicateReview(saved, { names: '  mark AND  mya ', source: 'google', date: '2026-09-12', externalId: '' })
    assert.equal(hit?.id, 1)
    assert.equal(findDuplicateReview(saved, { names: 'Mark and Mya', source: 'email', date: '2026-09-12', externalId: '' }), null)
    assert.equal(findDuplicateReview(saved, { names: 'Mark and Mya', source: 'google', date: '2026-09-13', externalId: 'g-new' }), null)
  })

  it('two unnamed reviews on one day are not duplicates', () => {
    assert.equal(findDuplicateReview(saved, { names: '', source: 'google', date: '2026-09-12', externalId: '' }), null)
  })
})

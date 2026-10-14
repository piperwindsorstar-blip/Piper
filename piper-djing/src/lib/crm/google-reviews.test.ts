import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  aggregateRatingJsonLd,
  parsePlaceDetails,
  parsePlaceSearch,
  writeReviewUrl,
} from './google-reviews.ts'
import { reviewDisplayFrom } from './store.server.ts'

/** The shape the Places API (New) Place Details endpoint answers with. */
const details = {
  rating: 4.94,
  userRatingCount: 37,
  googleMapsUri: 'https://maps.google.com/?cid=123',
  reviews: [
    {
      name: 'places/X/reviews/1',
      relativePublishTimeDescription: '2 months ago',
      rating: 5,
      text: { text: 'Piper made our night.', languageCode: 'en' },
      originalText: { text: 'Piper made our night.', languageCode: 'en' },
      authorAttribution: {
        displayName: 'Jordan L',
        uri: 'https://www.google.com/maps/contrib/1',
        photoUri: 'https://lh3.googleusercontent.com/a/photo',
      },
      publishTime: '2026-08-01T12:00:00Z',
      googleMapsUri: 'https://www.google.com/maps/reviews/data=1',
    },
    { rating: 5, text: { text: '' }, authorAttribution: { displayName: 'No text' } },
    {
      rating: 4,
      text: { text: 'Great music' },
      authorAttribution: { displayName: 'Sam', photoUri: 'javascript:alert(1)' },
    },
  ],
}

describe('Google reviews', () => {
  it('keeps Google rating, count, links and reviews exactly as sent', () => {
    const google = parsePlaceDetails(details, 'ChIJabc', '2026-10-13T00:00:00Z')
    assert.ok(google)
    assert.equal(google.rating, 4.9)
    assert.equal(google.count, 37)
    assert.equal(google.mapsUri, 'https://maps.google.com/?cid=123')
    assert.equal(google.writeUri, writeReviewUrl('ChIJabc'))
    assert.equal(google.reviews.length, 2, 'a review without text is left out')
    assert.equal(google.reviews[0]?.author, 'Jordan L')
    assert.equal(google.reviews[0]?.relative, '2 months ago')
    assert.equal(google.reviews[0]?.uri, 'https://www.google.com/maps/reviews/data=1')
    assert.equal(google.reviews[1]?.photo, '', 'only https photos')
    assert.equal(google.reviews[1]?.uri, 'https://maps.google.com/?cid=123')
  })

  it('hides the section when Google sends no reviews or no rating', () => {
    assert.equal(parsePlaceDetails({ ...details, reviews: [] }, 'x', 'now'), null)
    assert.equal(parsePlaceDetails({ ...details, rating: undefined }, 'x', 'now'), null)
    assert.equal(parsePlaceDetails(null, 'x', 'now'), null)
  })

  it('shows at most five reviews', () => {
    const many = { ...details, reviews: Array.from({ length: 8 }, () => details.reviews[0]) }
    assert.equal(parsePlaceDetails(many, 'x', 'now')?.reviews.length, 5)
  })

  it('builds aggregateRating only from the Google numbers', () => {
    const google = parsePlaceDetails(details, 'x', 'now')!
    const schema = JSON.parse(aggregateRatingJsonLd(google, 'https://piperpweddingdj.services/'))
    assert.equal(schema.aggregateRating.ratingValue, '4.9')
    assert.equal(schema.aggregateRating.reviewCount, 37)
  })

  it('reads place search results for the desk', () => {
    const places = parsePlaceSearch({
      places: [{ id: 'ChIJ1', displayName: { text: 'DJ Piper P' }, formattedAddress: 'Brantford, ON', rating: 5, userRatingCount: 12 }],
    })
    assert.deepEqual(places, [{ id: 'ChIJ1', name: 'DJ Piper P', address: 'Brantford, ON', rating: 5, count: 12 }])
  })

  it('defaults each page to both, and keeps what the owner chose', () => {
    assert.deepEqual(reviewDisplayFrom([]), { home: 'both', weddings: 'both' })
    assert.deepEqual(
      reviewDisplayFrom([{ page: 'home', mode: 'google' }, { page: 'weddings', mode: 'nonsense' }]),
      { home: 'google', weddings: 'both' },
    )
  })
})

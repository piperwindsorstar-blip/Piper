/**
 * Live Google reviews for the Piper DJing Google Business Profile, read from
 * the Places API (New) Place Details endpoint. Nothing here is ever typed by
 * hand: a review shows only if Google returned it, and the whole section is
 * hidden when Google returns none or cannot be reached.
 */

export type GoogleReview = {
  author: string
  /** The reviewer's Google profile, for attribution. */
  authorUri: string
  photo: string
  rating: number
  /** Google's own wording, e.g. "2 months ago". */
  relative: string
  text: string
  publishTime: string
  /** This review on Google Maps. */
  uri: string
}

export type GoogleReviews = {
  rating: number
  count: number
  mapsUri: string
  writeUri: string
  reviews: GoogleReview[]
  fetchedAt: string
}

export type ReviewDisplay = 'google' | 'mine' | 'both'
export type ReviewPage = 'home' | 'weddings'

export const REVIEW_DISPLAY_LABELS: Record<ReviewDisplay, string> = {
  google: 'Google reviews',
  mine: 'My reviews',
  both: 'Both',
}

export function isReviewDisplay(value: unknown): value is ReviewDisplay {
  return value === 'google' || value === 'mine' || value === 'both'
}

export const PLACE_FIELDS = 'rating,userRatingCount,reviews,googleMapsUri'
export const MAX_GOOGLE_REVIEWS = 5

/** Google's own "write a review" page for this place. */
export function writeReviewUrl(placeId: string): string {
  return `https://search.google.com/local/writereview?placeid=${encodeURIComponent(placeId)}`
}

function record(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function text(value: unknown, max = 4000): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function safeUrl(value: unknown): string {
  const url = text(value, 2000)
  return /^https:\/\//i.test(url) ? url : ''
}

/**
 * Turns a Place Details response into what the page shows. Null when Google
 * sent no rating or no reviews with text, so the section stays hidden.
 */
export function parsePlaceDetails(
  raw: unknown,
  placeId: string,
  fetchedAt: string,
): GoogleReviews | null {
  const place = record(raw)
  if (!place) return null
  const rating = Number(place.rating)
  const count = Number(place.userRatingCount)
  const mapsUri = safeUrl(place.googleMapsUri)
  if (!Number.isFinite(rating) || rating <= 0) return null
  if (!Number.isFinite(count) || count <= 0) return null
  const reviews: GoogleReview[] = []
  for (const item of Array.isArray(place.reviews) ? place.reviews : []) {
    const review = record(item)
    if (!review) continue
    const body = record(review.text) ?? record(review.originalText)
    const words = text(body?.text)
    const stars = Number(review.rating)
    if (!words || !Number.isFinite(stars)) continue
    const author = record(review.authorAttribution)
    reviews.push({
      author: text(author?.displayName, 120) || 'A Google user',
      authorUri: safeUrl(author?.uri),
      photo: safeUrl(author?.photoUri),
      rating: Math.max(1, Math.min(5, Math.round(stars))),
      relative: text(review.relativePublishTimeDescription, 60),
      text: words,
      publishTime: text(review.publishTime, 40),
      uri: safeUrl(review.googleMapsUri) || mapsUri,
    })
    if (reviews.length >= MAX_GOOGLE_REVIEWS) break
  }
  if (reviews.length === 0) return null
  return {
    rating: Math.round(rating * 10) / 10,
    count: Math.round(count),
    mapsUri,
    writeUri: writeReviewUrl(placeId),
    reviews,
    fetchedAt,
  }
}

/** schema.org aggregateRating, only ever from Google's own numbers. */
export function aggregateRatingJsonLd(
  google: Pick<GoogleReviews, 'rating' | 'count' | 'mapsUri'>,
  url: string,
): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'DJ Piper P',
    url,
    sameAs: google.mapsUri ? [google.mapsUri] : undefined,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Brantford',
      addressRegion: 'ON',
      addressCountry: 'CA',
    },
    aggregateRating: {
      '@type': 'AggregateRating',
      ratingValue: google.rating.toFixed(1),
      reviewCount: google.count,
      bestRating: '5',
      worstRating: '1',
    },
  })
}

export type PlaceCandidate = {
  id: string
  name: string
  address: string
  rating: number
  count: number
}

/** Places Text Search results, for the desk's "find my Place ID" helper. */
export function parsePlaceSearch(raw: unknown): PlaceCandidate[] {
  const body = record(raw)
  const places = Array.isArray(body?.places) ? body.places : []
  return places.flatMap((item) => {
    const place = record(item)
    const id = text(place?.id, 200)
    if (!place || !id) return []
    return [
      {
        id,
        name: text(record(place.displayName)?.text, 200),
        address: text(place.formattedAddress, 300),
        rating: Number(place.rating) || 0,
        count: Number(place.userRatingCount) || 0,
      },
    ]
  })
}

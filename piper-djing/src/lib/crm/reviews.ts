export const REVIEW_SOURCES = ['google', 'email', 'text', 'other'] as const

export type ReviewSource = (typeof REVIEW_SOURCES)[number]

export type PublicReview = {
  id: number
  quote: string
  names: string
  eventType: string
  town: string
  date: string
  source: ReviewSource
  /** 1 to 5, or null when the review has no star rating. */
  stars: number | null
  /** Where the review lives, e.g. its Google review link; '' for none. */
  link: string
}

export type ReviewView = PublicReview & {
  show: boolean
  /** The bot's own id for the review, used to skip duplicates; '' for none. */
  externalId: string
}

export type ReviewDraft = {
  quote: string
  names: string
  eventType: string
  town: string
  date: string
  source: string
  show: boolean
  /** Optional. Left out on an edit, the saved value stays. */
  stars?: unknown
  link?: unknown
  externalId?: unknown
}

const SOURCE_LABEL: Record<ReviewSource, string> = {
  google: 'Google',
  email: 'Email',
  text: 'Text',
  other: 'Other',
}

export function isReviewSource(value: string): value is ReviewSource {
  return (REVIEW_SOURCES as readonly string[]).includes(value)
}

export function reviewSourceLabel(source: ReviewSource): string {
  return SOURCE_LABEL[source]
}

export function formatReviewDate(iso: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso)
  if (!match) return ''
  const year = Number(match[1])
  const month = Number(match[2])
  const day = Number(match[3])
  return new Intl.DateTimeFormat('en-CA', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

export function reviewCaption(review: PublicReview): string {
  return [
    review.names,
    review.eventType,
    review.town,
    formatReviewDate(review.date),
    reviewSourceLabel(review.source),
  ]
    .filter((part) => part.length > 0)
    .join(' · ')
}

/** Stars from a draft: null for none, or a whole number 1 to 5. */
export function parseStars(value: unknown): number | null {
  if (value === undefined || value === null || value === '' || value === 0) {
    return null
  }
  const stars = typeof value === 'string' ? Number(value.trim()) : value
  if (typeof stars !== 'number' || !Number.isInteger(stars) || stars < 1 || stars > 5) {
    throw new Error('Stars must be a whole number from 1 to 5.')
  }
  return stars
}

/** A review link: an http(s) address, or '' for none. */
export function parseReviewLink(value: unknown): string {
  if (value === undefined || value === null) return ''
  if (typeof value !== 'string') throw new Error('The review link must be a web address.')
  const link = value.trim()
  if (!link) return ''
  if (link.length > 500) throw new Error('That review link is too long.')
  let url: URL
  try {
    url = new URL(link)
  } catch {
    throw new Error('The review link must be a web address.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('The review link must be a web address.')
  }
  return url.toString()
}

export function parseExternalId(value: unknown): string {
  if (value === undefined || value === null) return ''
  const id = String(value).trim()
  if (id.length > 200) throw new Error('That externalId is too long.')
  return id
}

function sameNames(a: string, b: string): boolean {
  const norm = (value: string) => value.trim().toLowerCase().replace(/\s+/g, ' ')
  return norm(a) !== '' && norm(a) === norm(b)
}

/**
 * The review already on the page that this one repeats: the same externalId,
 * or the same names, source and date. Reviews with no names are only matched
 * by externalId, so two unnamed reviews on one day both stay.
 */
export function findDuplicateReview<T extends {
  names: string
  source: string
  date: string
  externalId: string
}>(
  existing: T[],
  draft: { names: string; source: string; date: string; externalId: string },
): T | null {
  const externalId = draft.externalId.trim()
  if (externalId) {
    const byId = existing.find((review) => review.externalId === externalId)
    if (byId) return byId
  }
  return (
    existing.find(
      (review) =>
        sameNames(review.names, draft.names) &&
        review.source === draft.source &&
        review.date === draft.date.trim(),
    ) ?? null
  )
}

/** "4 out of 5 stars" for screen readers, or '' for none. */
export function starsLabel(stars: number | null): string {
  return stars ? `${stars} out of 5 stars` : ''
}

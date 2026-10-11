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
}

export type ReviewView = PublicReview & { show: boolean }

export type ReviewDraft = {
  quote: string
  names: string
  eventType: string
  town: string
  date: string
  source: string
  show: boolean
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

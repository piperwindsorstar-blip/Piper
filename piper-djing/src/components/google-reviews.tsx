import { useState } from 'react'
import { aggregateRatingJsonLd } from '../lib/crm/google-reviews.ts'
import type { GoogleReview, GoogleReviews } from '../lib/crm/google-reviews.ts'

type Variant = 'dark' | 'light'

const LOOK: Record<
  Variant,
  {
    card: string
    muted: string
    faint: string
    accent: string
    primary: string
    ghost: string
    eyebrow: string
  }
> = {
  dark: {
    card: 'border-white/10 bg-white/[0.04] backdrop-blur-xl hover:border-neon/50',
    muted: 'text-white/85',
    faint: 'text-white/55',
    accent: 'text-hot',
    primary:
      'bg-neon text-white shadow-[0_0_28px_rgba(255,0,127,0.45)] hover:bg-hot',
    ghost: 'border border-white/25 text-white hover:border-hot',
    eyebrow: 'text-hot',
  },
  light: {
    card: 'border-line bg-paper',
    muted: 'text-ink',
    faint: 'text-soft',
    accent: 'text-violet',
    primary: 'bg-violet text-white hover:brightness-110',
    ghost: 'border border-line text-ink hover:border-violet',
    eyebrow: 'text-violet',
  },
}

/** Google's wordmark in its own colours, as Places attribution asks. */
export function GoogleWordmark({ className = '' }: { className?: string }) {
  const letters: [string, string][] = [
    ['G', '#4285F4'],
    ['o', '#EA4335'],
    ['o', '#FBBC05'],
    ['g', '#4285F4'],
    ['l', '#34A853'],
    ['e', '#EA4335'],
  ]
  return (
    <span
      className={`inline-flex font-sans font-semibold tracking-tight ${className}`}
      aria-label="Google"
    >
      {letters.map(([letter, colour], index) => (
        <span key={index} style={{ color: colour }} aria-hidden="true">
          {letter}
        </span>
      ))}
    </span>
  )
}

function Stars({ rating, size = 'h-4 w-4' }: { rating: number; size?: string }) {
  const whole = Math.round(rating * 2) / 2
  return (
    <span
      className="inline-flex gap-0.5"
      role="img"
      aria-label={`${rating.toFixed(1)} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const fill = whole >= n ? 1 : whole >= n - 0.5 ? 0.5 : 0
        return (
          <svg key={n} viewBox="0 0 24 24" className={size} aria-hidden="true">
            <defs>
              <linearGradient id={`star-${n}-${fill}`}>
                <stop offset={`${fill * 100}%`} stopColor="#FBBC05" />
                <stop offset={`${fill * 100}%`} stopColor="#9CA3AF" stopOpacity="0.45" />
              </linearGradient>
            </defs>
            <path
              d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
              fill={`url(#star-${n}-${fill})`}
            />
          </svg>
        )
      })}
    </span>
  )
}

function ReviewCard({
  review,
  variant,
  compact = false,
}: {
  review: GoogleReview
  variant: Variant
  compact?: boolean
}) {
  const look = LOOK[variant]
  const [open, setOpen] = useState(false)
  const long = review.text.length > (compact ? 120 : 240)
  const initial = review.author.trim()[0]?.toUpperCase() ?? 'G'
  return (
    <figure className={`flex flex-col rounded-2xl border p-6 transition ${look.card}`}>
      <figcaption className="flex items-center gap-3">
        {review.photo ? (
          <img
            src={review.photo}
            alt=""
            width={40}
            height={40}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="h-10 w-10 rounded-full object-cover"
          />
        ) : (
          <span className="grid h-10 w-10 place-items-center rounded-full bg-[#4285F4] font-semibold text-white">
            {initial}
          </span>
        )}
        <span className="min-w-0">
          {review.authorUri ? (
            <a
              href={review.authorUri}
              target="_blank"
              rel="noreferrer"
              className={`block truncate font-semibold hover:underline ${compact ? 'text-lg' : ''} ${look.muted}`}
            >
              {review.author}
            </a>
          ) : (
            <span className={`block truncate font-semibold ${compact ? 'text-lg' : ''} ${look.muted}`}>
              {review.author}
            </span>
          )}
          <span className={`flex items-center gap-2 text-sm ${look.faint}`}>
            <Stars rating={review.rating} size={compact ? 'h-5 w-5' : 'h-3.5 w-3.5'} />
            {review.relative}
          </span>
        </span>
      </figcaption>
      <blockquote
        className={`mt-4 flex-1 whitespace-pre-line leading-relaxed ${compact ? `text-sm ${look.faint}` : look.muted} ${open || !long ? '' : compact ? 'line-clamp-3' : 'line-clamp-5'}`}
      >
        {review.text}
      </blockquote>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-2 text-sm">
        {long ? (
          <button
            type="button"
            className={`min-h-11 font-semibold ${look.accent} hover:underline`}
            aria-expanded={open}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Show less' : 'Read more'}
          </button>
        ) : (
          <span />
        )}
        {review.uri ? (
          <a
            href={review.uri}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex min-h-11 items-center gap-1 ${look.faint} hover:underline`}
          >
            View on <GoogleWordmark />
          </a>
        ) : null}
      </div>
    </figure>
  )
}

/**
 * Live Google reviews: the rating, the count and up to five reviews exactly as
 * Google returned them, with Google's attribution and links back to Google.
 * Renders nothing when there are none.
 */
export function GoogleReviewsSection({
  google,
  variant,
  pageUrl,
  heading = 'What couples say.',
  anchorId = 'google-reviews',
  compact = false,
  hideAuthors = [],
}: {
  google: GoogleReviews | null
  variant: Variant
  pageUrl: string
  heading?: string
  /** "reviews" when this is the page's only review section (menu links). */
  anchorId?: string
  /** Rating, name and date lead; the quote is smaller and clamped. */
  compact?: boolean
  /** Reviewer names left out of this showcase. Review text is never edited. */
  hideAuthors?: readonly string[]
}) {
  if (!google || google.reviews.length === 0) return null
  const hidden = new Set(hideAuthors.map((name) => name.trim().toLowerCase()))
  const shown = google.reviews.filter(
    (review) => !hidden.has(review.author.trim().toLowerCase()),
  )
  const look = LOOK[variant]
  return (
    <section
      id={anchorId}
      className="mx-auto max-w-7xl scroll-mt-24 px-5 py-20"
      aria-labelledby="google-reviews-title"
    >
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: aggregateRatingJsonLd(google, pageUrl) }}
      />
      <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
        <div>
          <p className={`font-mono text-xs uppercase tracking-[0.22em] ${look.eyebrow}`}>
            Reviews from <GoogleWordmark className="normal-case tracking-normal" />
          </p>
          <h2
            id="google-reviews-title"
            className="mt-4 font-display text-4xl font-bold md:text-6xl"
          >
            {heading}
          </h2>
          <p className="mt-4 flex flex-wrap items-center gap-3">
            <span className="font-display text-4xl font-bold">
              {google.rating.toFixed(1)}
            </span>
            <Stars rating={google.rating} size="h-6 w-6" />
            <span className={look.faint}>
              {`${google.count ?? ''} Google review${google.count === 1 ? '' : 's'}`}
            </span>
          </p>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row">
          {google.mapsUri ? (
            <a
              href={google.mapsUri}
              target="_blank"
              rel="noreferrer"
              className={`inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 font-semibold transition ${look.ghost}`}
            >
              See all reviews on Google
            </a>
          ) : null}
          <a
            href={google.writeUri}
            target="_blank"
            rel="noreferrer"
            className={`inline-flex min-h-11 items-center justify-center rounded-full px-6 py-3 font-semibold transition ${look.primary}`}
          >
            Leave us a review
          </a>
        </div>
      </div>
      {shown.length > 0 ? (
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
          {shown.map((review) => (
            <ReviewCard
              key={`${review.author}-${review.publishTime}`}
              review={review}
              variant={variant}
              compact={compact}
            />
          ))}
        </div>
      ) : null}
      <p className={`mt-6 text-xs ${look.faint}`}>
        Reviews and rating from <GoogleWordmark />, shown as Google returns
        them.
      </p>
    </section>
  )
}

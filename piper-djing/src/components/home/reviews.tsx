import type { PublicReview } from '../../lib/crm/reviews.ts'
import { reviewCaption } from '../../lib/crm/reviews.ts'
import { ReviewCarousel } from '../review-carousel.tsx'
import { ReviewQuote } from '../review-quote.tsx'
import { ReviewLink, ReviewStars } from '../review-stars.tsx'
import { LINKS } from './content.ts'

export function Reviews({ reviews }: { reviews: PublicReview[] }) {
  return (
    <section id="reviews" className="bp-pad scroll-mt-24">
      <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="bp-k bp-pink">Kind words</p>
          <h2 className="bp-h2 mt-3">
            What people <span className="bp-pink">say.</span>
          </h2>
        </div>
        <a
          href={LINKS.review}
          target="_blank"
          rel="noreferrer"
          className="bp-btn bp-btn--line bp-btn--small"
        >
          Read or leave a Google review →
        </a>
      </div>
      {reviews.length > 0 ? (
        <div className="mt-10">
          <ReviewCarousel tone="dark" label="What people say">
          {reviews.map((review) => (
            <figure
              key={review.id}
              className="flex w-full flex-col border-2 border-white/25 bg-black/70 p-6 backdrop-blur-xl transition hover:border-neon"
            >
              <ReviewStars stars={review.stars} />
              <ReviewQuote
                text={`“${review.quote ?? ''}”`}
                className="leading-relaxed text-white/85"
                buttonClassName="text-hot"
              />
              <figcaption className="mt-5 border-t border-white/10 pt-4 text-sm text-white/50">
                {reviewCaption(review)}
                <ReviewLink link={review.link} className="font-semibold text-hot" />
              </figcaption>
            </figure>
          ))}
          </ReviewCarousel>
        </div>
      ) : null}
    </section>
  )
}

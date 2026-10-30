import type { PublicReview } from '../../lib/crm/reviews.ts'
import { reviewCaption } from '../../lib/crm/reviews.ts'
import { ReviewCarousel } from '../review-carousel.tsx'
import { ReviewQuote } from '../review-quote.tsx'
import { ReviewLink, ReviewStars } from '../review-stars.tsx'
import { LINKS } from './content.ts'

export function Reviews({ reviews }: { reviews: PublicReview[] }) {
  return (
    <section
      id="reviews"
      className="mx-auto max-w-6xl scroll-mt-24 px-5 py-16 text-center"
    >
      <a
        href={LINKS.review}
        target="_blank"
        rel="noreferrer"
        className="font-semibold text-violet hover:underline"
      >
        Read or leave a Google review
      </a>
      {reviews.length > 0 ? (
        <div className="mt-10 text-left">
          <ReviewCarousel tone="light" label="Reviews">
          {reviews.map((review) => (
            <figure
              key={review.id}
              className="flex w-full flex-col rounded-2xl border border-line bg-paper p-6"
            >
              <ReviewStars stars={review.stars} />
              <ReviewQuote
                text={`“${review.quote ?? ''}”`}
                className="leading-relaxed text-ink"
                buttonClassName="text-neon"
              />
              <figcaption className="mt-5 border-t border-line pt-4 text-sm text-soft">
                {reviewCaption(review)}
                <ReviewLink link={review.link} className="font-semibold text-violet" />
              </figcaption>
            </figure>
          ))}
          </ReviewCarousel>
        </div>
      ) : null}
    </section>
  )
}

import type { PublicReview } from '../../lib/crm/reviews.ts'
import { reviewCaption } from '../../lib/crm/reviews.ts'
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
        <div className="mt-10 grid gap-5 text-left md:grid-cols-3">
          {reviews.map((review) => (
            <figure
              key={review.id}
              className="flex flex-col rounded-2xl border border-line bg-paper p-6"
            >
              <blockquote className="flex-1 leading-relaxed text-ink">
                “{review.quote}”
              </blockquote>
              <figcaption className="mt-5 border-t border-line pt-4 text-sm text-soft">
                {reviewCaption(review)}
              </figcaption>
            </figure>
          ))}
        </div>
      ) : null}
    </section>
  )
}

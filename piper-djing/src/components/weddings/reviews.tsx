import { LINKS, REVIEWS, SHOW_PLACEHOLDER_NOTES } from './content.ts'
import { Stars } from './icon.tsx'
import { Eyebrow } from './ui.tsx'

export function Reviews() {
  return (
    <section id="reviews" className="mx-auto max-w-6xl scroll-mt-24 px-5 py-24">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>What Couples Say</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-bold text-balance md:text-5xl">
            Proof on the dance floor.
          </h2>
        </div>
        <a
          href={LINKS.review}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-violet hover:underline"
        >
          Leave a Google review →
        </a>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {REVIEWS.map((review) => (
          <figure
            key={review.w}
            className="flex flex-col rounded-xl border border-line bg-paper p-6 transition hover:border-violet hover:shadow-[0_12px_32px_-16px_rgba(124,58,237,0.35)]"
          >
            <div className="flex items-center justify-between">
              <Stars />
              {SHOW_PLACEHOLDER_NOTES ? (
                <span className="rounded border border-line px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-soft uppercase">
                  Sample copy
                </span>
              ) : null}
            </div>
            <blockquote className="mt-4 flex-1 leading-relaxed text-ink/85">
              “{review.q}”
            </blockquote>
            <figcaption className="mt-5 flex items-center justify-between border-t border-line pt-4 text-sm text-soft">
              <span>{review.w}</span>
              <a
                href={LINKS.review}
                target="_blank"
                rel="noreferrer"
                className="font-semibold text-violet hover:underline"
              >
                Google Review
              </a>
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

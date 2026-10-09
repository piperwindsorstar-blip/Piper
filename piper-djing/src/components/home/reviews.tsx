import { LINKS, REVIEWS, SHOW_PLACEHOLDER_NOTES } from './content.ts'
import { Eyebrow, Stars } from './ui.tsx'

export function Reviews() {
  return (
    <section id="reviews" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
        <div>
          <Eyebrow>Kind words</Eyebrow>
          <h2 className="mt-4 font-display text-4xl font-bold md:text-6xl">
            What people say.
          </h2>
        </div>
        <a
          href={LINKS.review}
          target="_blank"
          rel="noreferrer"
          className="font-semibold text-hot hover:underline"
        >
          Read or leave a Google review →
        </a>
      </div>
      <div className="mt-10 grid gap-5 md:grid-cols-3">
        {REVIEWS.map((quote) => (
          <figure
            key={quote}
            className="flex flex-col rounded-2xl border border-white/10 bg-white/[0.04] p-6 backdrop-blur-xl transition hover:border-neon/50"
          >
            <div className="flex items-center justify-between">
              <Stars />
              {SHOW_PLACEHOLDER_NOTES ? (
                <span className="rounded border border-white/15 px-1.5 py-0.5 font-mono text-[10px] tracking-wider text-white/45 uppercase">
                  Sample copy
                </span>
              ) : null}
            </div>
            <blockquote className="mt-4 flex-1 leading-relaxed text-white/85">
              “{quote}”
            </blockquote>
            <figcaption className="mt-5 border-t border-white/10 pt-4 text-sm text-white/50">
              Google Review
            </figcaption>
          </figure>
        ))}
      </div>
    </section>
  )
}

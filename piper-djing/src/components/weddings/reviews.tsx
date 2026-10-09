import { LINKS } from './content.ts'

export function Reviews() {
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
        Leave a Google review
      </a>
    </section>
  )
}

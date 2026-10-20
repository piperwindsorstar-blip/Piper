import { starsLabel } from '../lib/crm/reviews.ts'

/** Gold stars for a review's 1–5 rating; nothing when it has none. */
export function ReviewStars({ stars }: { stars: number | null | undefined }) {
  if (!stars) return null
  return (
    <p
      className="mb-3 flex gap-0.5"
      role="img"
      aria-label={starsLabel(stars)}
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <svg key={n} viewBox="0 0 24 24" className="h-4 w-4" aria-hidden="true">
          <path
            d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"
            fill={n <= stars ? '#FBBC05' : '#9CA3AF'}
            fillOpacity={n <= stars ? 1 : 0.45}
          />
        </svg>
      ))}
    </p>
  )
}

/** "Read on Google" (or the site's name) when the review has a link. */
export function ReviewLink({
  link,
  className,
}: {
  link: string | undefined
  className: string
}) {
  if (!link) return null
  let site = 'source'
  try {
    const host = new URL(link).hostname
    site = /google\./.test(host) || host === 'g.page' || host.endsWith('goo.gl') ? 'Google' : host.replace(/^www\./, '')
  } catch {
    return null
  }
  return (
    <a
      href={link}
      target="_blank"
      rel="noreferrer"
      className={`mt-1 flex min-h-11 w-fit items-center hover:underline ${className}`}
    >{`Read on ${site ?? ''}`}
    </a>
  )
}

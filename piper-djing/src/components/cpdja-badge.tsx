/** Member badge: the Canadian Professional DJ Association logo, linking to cpdja.ca. */
export const CPDJA_URL = 'https://cpdja.ca'

export function CpdjaBadge() {
  return (
    <a
      href={CPDJA_URL}
      target="_blank"
      rel="noreferrer"
      title="Member of the Canadian Professional DJ Association"
      className="inline-flex shrink-0 rounded-lg bg-white px-2.5 py-1.5 shadow-sm transition hover:opacity-90"
    >
      <picture>
        <source srcSet="/brand/cpdja.webp" type="image/webp" />
        <img
          src="/brand/cpdja.png"
          alt="Member of the Canadian Professional DJ Association (CPDJA)"
          width={480}
          height={197}
          loading="lazy"
          decoding="async"
          className="h-10 w-auto"
        />
      </picture>
    </a>
  )
}

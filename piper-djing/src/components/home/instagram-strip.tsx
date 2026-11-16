import { INSTAGRAM_POSTS, LINKS } from './content.ts'

/** The six posts that fill one row on a wide screen and two on a phone. */
const SHOWN = INSTAGRAM_POSTS.slice(0, 6)

export function InstagramStrip() {
  return (
    <section aria-labelledby="insta-title">
      <div className="bp-pad flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
        <div>
          <p className="bp-k bp-pink">On the gram</p>
          <h2 id="insta-title" className="bp-h2 mt-3">
            Follow the nights. <span className="bp-pink">@DJ_PIPERP</span>
          </h2>
        </div>
        <div className="flex flex-wrap gap-3">
          <a
            href={LINKS.insta}
            target="_blank"
            rel="noreferrer"
            className="bp-btn bp-btn--line bp-btn--small"
          >
            Open Instagram
          </a>
          {LINKS.facebook ? (
            <a
              href={LINKS.facebook}
              target="_blank"
              rel="noreferrer"
              className="bp-btn bp-btn--line bp-btn--small"
            >
              Facebook
            </a>
          ) : null}
        </div>
      </div>
      <div className="bp-insta">
        {SHOWN.map(({ src, position }) => (
          <a
            key={src}
            href={LINKS.insta}
            target="_blank"
            rel="noreferrer"
            aria-label="Open @DJ_PIPERP on Instagram"
          >
            <img
              src={src}
              alt=""
              width={720}
              height={720}
              style={{ objectPosition: position }}
              loading="lazy"
              decoding="async"
              sizes="(min-width: 1024px) 17vw, 33vw"
            />
          </a>
        ))}
      </div>
    </section>
  )
}

import { INSTAGRAM_POSTS, LINKS, SHOW_PLACEHOLDER_NOTES } from './content.ts'
import { Icon } from './icon.tsx'
import { Eyebrow } from './ui.tsx'

export function InstagramStrip() {
  return (
    <section className="border-y border-white/10 bg-ink-900 py-16">
      <div className="mx-auto max-w-7xl px-5">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
          <div>
            <Eyebrow>On the gram</Eyebrow>
            <h2 className="mt-3 font-display text-3xl font-bold md:text-4xl">
              Follow the nights. <span className="text-neon">@DJ_PIPERP</span>
            </h2>
          </div>
          <a
            href={LINKS.insta}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 font-semibold text-hot hover:underline"
          >
            <Icon n="insta" className="h-4 w-4" />
            Open Instagram
          </a>
          {LINKS.facebook ? (
            <a
              href={LINKS.facebook}
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-2 font-semibold text-hot hover:underline"
            >
              <Icon n="facebook" className="h-4 w-4" />
              Facebook
            </a>
          ) : null}
        </div>
        <div className="mt-8 grid grid-cols-3 gap-2 md:gap-3">
          {INSTAGRAM_POSTS.map(({ src, position }) => (
            <a
              key={src}
              href={LINKS.insta}
              target="_blank"
              rel="noreferrer"
              aria-label="Open @DJ_PIPERP on Instagram"
              className="group relative block aspect-[4/5] overflow-hidden rounded-xl border border-white/10"
            >
              <img
                src={src}
                alt=""
                width={720}
                height={900}
                style={{ objectPosition: position }}
                className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
                loading="lazy"
                decoding="async"
                sizes="(min-width: 1280px) 400px, 33vw"
              />
              <span className="absolute inset-0 bg-neon/0 transition group-hover:bg-neon/20" />
            </a>
          ))}
        </div>
        {SHOW_PLACEHOLDER_NOTES ? (
          <p className="mt-3 font-mono text-xs text-white/40">
            Placeholder tiles. Swap for real Instagram posts or a feed embed.
          </p>
        ) : null}
      </div>
    </section>
  )
}

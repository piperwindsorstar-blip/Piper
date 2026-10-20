import { LINKS, PHOTOS } from './content.ts'
import { Icon } from './icon.tsx'
import { ButtonGhost, ButtonPrimary } from './ui.tsx'

export function FinalCta() {
  return (
    <section className="relative isolate overflow-hidden py-32 text-center">
      <img
        src={PHOTOS.beam}
        alt=""
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-55"
        loading="lazy"
        sizes="100vw"
      />
      <div className="absolute inset-0 -z-10 bg-ink-950/50" />
      <p className="font-serif text-2xl text-hot italic">Let’s talk.</p>
      <h2 className="mx-auto mt-3 max-w-4xl px-5 font-display text-5xl leading-[0.95] font-extrabold text-balance md:text-8xl">
        {'Let’s make your night '}
        <span className="text-neon text-glow">yours.</span>
      </h2>
      <p className="mx-auto mt-6 max-w-lg px-5 text-lg text-white/75">
        Tell me about your event. There’s no pressure and no pushy sales talk,
        just a real conversation with a DJ who cares.
      </p>
      <div className="mt-9 flex flex-col justify-center gap-3 px-5 sm:flex-row">
        <a
          href="#check-a-date"
          className="inline-flex items-center justify-center gap-2 rounded-full bg-neon px-7 py-3.5 font-semibold text-white shadow-[0_0_28px_rgba(255,0,127,0.45)] transition hover:bg-hot"
        >
          Check a date
        </a>
        <ButtonPrimary to={LINKS.weddings}>Explore Weddings</ButtonPrimary>
        <ButtonGhost to={LINKS.book}>Plan Your Event</ButtonGhost>
      </div>
      <a
        href={`mailto:${LINKS.email}`}
        className="mt-7 inline-flex min-h-11 items-center gap-2 px-5 text-lg font-semibold text-white underline underline-offset-4 hover:text-hot"
      >
        <Icon n="mail" className="h-5 w-5 text-hot" />
        Email Piper: {LINKS.email}
      </a>
      <div className="mt-3 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 px-5 text-white/75">
        <a
          href={LINKS.insta}
          target="_blank"
          rel="noreferrer"
          className="inline-flex min-h-11 items-center gap-2 hover:text-white"
        >
          <Icon n="insta" className="h-4 w-4 text-hot" />
          @DJ_PIPERP
        </a>
        {LINKS.facebook ? (
          <a
            href={LINKS.facebook}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center gap-2 hover:text-white"
          >
            <Icon n="facebook" className="h-4 w-4 text-hot" />
            Facebook
          </a>
        ) : null}
      </div>
    </section>
  )
}

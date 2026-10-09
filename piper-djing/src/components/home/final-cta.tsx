import { LINKS, PHOTOS } from './content.ts'
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
        Let’s make your night{' '}
        <span className="text-neon text-glow">yours.</span>
      </h2>
      <p className="mx-auto mt-6 max-w-lg px-5 text-lg text-white/75">
        Tell me about your event. There’s no pressure and no pushy sales talk,
        just a real conversation with a DJ who cares.
      </p>
      <div className="mt-9 flex flex-col justify-center gap-3 px-5 sm:flex-row">
        <ButtonPrimary to={LINKS.weddings}>Explore Weddings</ButtonPrimary>
        <ButtonGhost to={LINKS.book}>Plan Your Event</ButtonGhost>
      </div>
      <p className="mt-6 px-5 text-white/70 select-all">{LINKS.email}</p>
    </section>
  )
}

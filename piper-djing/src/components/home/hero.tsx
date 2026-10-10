import { LINKS, PHOTOS } from './content.ts'
import { SpinningBadge } from './spinning-badge.tsx'
import { ButtonGhost, ButtonPrimary, Eyebrow } from './ui.tsx'

export function Hero() {
  return (
    <section className="relative isolate overflow-hidden">
      <img
        src={PHOTOS.mixer}
        alt="DJ mixer and headphones under pink light"
        className="absolute inset-0 -z-10 h-full w-full object-cover opacity-80"
        fetchPriority="high"
      />
      <div className="absolute inset-0 -z-10 bg-linear-to-t from-ink-950 via-ink-950/40 to-ink-950/20" />
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(50%_50%_at_20%_60%,rgba(255,0,127,0.18),transparent)]" />
      <div className="mx-auto max-w-7xl px-5 pt-20 pb-24 md:pt-36 md:pb-32">
        <Eyebrow>Wedding & events DJ · Brantford, Ontario</Eyebrow>
        <h1 className="mt-6 max-w-full font-display text-[clamp(3.4rem,13vw,11rem)] font-extrabold leading-[0.88] tracking-tight text-balance">
          Hi, I’m <br />
          <span className="text-neon text-glow">Piper P.</span>
        </h1>
        <div className="mt-10 grid items-end gap-10 lg:grid-cols-[1fr_auto]">
          <div>
            <p className="max-w-2xl font-serif text-3xl leading-snug text-white/90 italic md:text-4xl">
              The DJ who makes the night about you.
            </p>
            <p className="mt-5 max-w-xl text-lg leading-relaxed text-white/70">
              I bring big energy, a kind heart and a plan for everything. From
              the first call to the last song, you get a DJ who listens, adapts
              and genuinely cares how your night feels.
            </p>
            <div className="mt-9 flex flex-col gap-3 sm:flex-row">
              <a
                href="#check-a-date"
                className="group inline-flex items-center justify-center gap-2 rounded-full bg-neon px-7 py-3.5 font-semibold text-white shadow-[0_0_28px_rgba(255,0,127,0.45)] transition hover:bg-hot hover:shadow-[0_0_44px_rgba(255,20,147,0.7)]"
              >
                Check a date
              </a>
              <ButtonPrimary to={LINKS.weddings}>
                Explore Weddings
              </ButtonPrimary>
              <ButtonGhost to={LINKS.book}>Say Hello</ButtonGhost>
            </div>
          </div>
          <div className="hidden lg:block">
            <SpinningBadge />
          </div>
        </div>
      </div>
    </section>
  )
}

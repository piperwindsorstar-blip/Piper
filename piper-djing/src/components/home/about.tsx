import { LINKS, PHOTOS, PORTRAIT_ALT, PORTRAIT_SRC } from './content.ts'
import { Icon } from './icon.tsx'
import { Eyebrow } from './ui.tsx'

export function About() {
  const portrait = PORTRAIT_SRC.length > 0
  return (
    <section
      id="about"
      className="mx-auto grid max-w-7xl scroll-mt-24 items-center gap-14 px-5 py-24 lg:grid-cols-[0.9fr_1.1fr]"
    >
      <div className="relative">
        <div className="relative aspect-[4/5] overflow-hidden rounded-3xl border border-neon/30 bg-ink-800 shadow-[0_0_60px_rgba(255,0,127,0.18)]">
          <img
            src={portrait ? PORTRAIT_SRC : PHOTOS.phones}
            alt={portrait ? PORTRAIT_ALT : ''}
            className={`absolute inset-0 h-full w-full object-cover ${portrait ? '' : 'opacity-70'}`}
            loading="lazy"
            sizes="(min-width: 1024px) 40vw, 90vw"
          />
          {portrait ? null : (
            <>
              <div className="absolute inset-0 bg-linear-to-t from-ink-950 via-transparent to-neon/10" />
              <div className="absolute inset-0 grid place-items-center">
                <div className="rounded-2xl border border-dashed border-white/40 bg-black/50 px-6 py-5 text-center backdrop-blur">
                  <Icon n="user" className="mx-auto mb-2 h-8 w-8 text-hot" />
                  <p className="font-mono text-xs tracking-widest text-white/80 uppercase">
                    Portrait of Piper goes here
                  </p>
                </div>
              </div>
            </>
          )}
        </div>
        <div className="absolute -bottom-6 -right-2 rotate-3 rounded-2xl border border-white/15 bg-ink-900/95 px-5 py-4 shadow-xl backdrop-blur md:-right-8">
          <p className="font-mono text-[10px] tracking-widest text-hot uppercase">
            Community DJ
          </p>
          <p className="mt-1 font-display text-lg font-bold">
            Charity & Private Events
          </p>
          <p className="text-sm text-white/55">
            Running With The Bulls · Tillsonburg
          </p>
        </div>
      </div>
      <div>
        <Eyebrow>About</Eyebrow>
        <h2 className="mt-4 font-display text-4xl leading-tight font-bold text-balance md:text-6xl">
          Behind the booth is a{' '}
          <span className="font-serif font-normal text-neon italic">
            person
          </span>{' '}
          who truly cares.
        </h2>
        <div className="mt-8 space-y-5 text-lg leading-relaxed text-white/75">
          <p>
            I’m Martin Piper, but everyone knows me as{' '}
            <span className="font-semibold text-white">Piper P</span>. I play
            weddings, private parties, club nights and community events across
            Brantford and the surrounding area.
          </p>
          <p>
            I love giving back. I support charity events like Tillsonburg
            Running With The Bulls, a race that raises money for families
            affected by cancer. I’m also a proud ally, and I’ve had the honour
            of serving as a resident DJ for Brantford Pride.
          </p>
          <p>
            I treat every event like a production. Long before the first song, I
            think about the gear, the timing, the people and the backup plan, so
            the night runs smoothly and you never see the work behind it.
          </p>
          <p>
            What I love most is simple: watching a room go from polite to
            packed, and knowing the people who hired me are having the best
            night of their lives.
          </p>
        </div>
        <div className="mt-8 flex flex-wrap gap-x-8 gap-y-3 text-sm text-white/65">
          <span className="flex items-center gap-2">
            <Icon n="pin" className="h-4 w-4 text-hot" />
            Brantford, Ontario
          </span>
          <a
            href={LINKS.insta}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-2 hover:text-white"
          >
            <Icon n="insta" className="h-4 w-4 text-hot" />
            @DJ_PIPERP
          </a>
        </div>
      </div>
    </section>
  )
}

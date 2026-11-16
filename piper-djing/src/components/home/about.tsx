import { LINKS, PORTRAIT_ALT, PORTRAIT_SRC } from './content.ts'

export function About() {
  return (
    <section id="about" className="bp-split scroll-mt-24">
      <img
        src={PORTRAIT_SRC}
        alt={PORTRAIT_ALT}
        className="bp-split__photo"
        loading="lazy"
        sizes="(min-width: 896px) 50vw, 100vw"
      />
      <div className="bp-white bp-pad bp-split__panel">
        <p className="bp-k bp-pink">About</p>
        <h2 className="bp-h2 mt-3 text-[clamp(2.2rem,4.6vw,4rem)]">
          Behind the booth is a person who truly{' '}
          <span className="bp-pink">cares.</span>
        </h2>
        <div className="mt-6 space-y-4 text-lg leading-relaxed">
          <p>
            {'I’m Martin Piper, but everyone knows me as '}
            <strong>Piper P</strong>. I play
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
        <div className="mt-7 flex flex-wrap gap-3">
          <a
            href={LINKS.insta}
            target="_blank"
            rel="noreferrer"
            className="bp-btn bp-btn--black bp-btn--small"
          >
            @DJ_PIPERP
          </a>
          {LINKS.facebook ? (
            <a
              href={LINKS.facebook}
              target="_blank"
              rel="noreferrer"
              className="bp-btn bp-btn--black bp-btn--small"
            >
              Facebook
            </a>
          ) : null}
        </div>
      </div>
    </section>
  )
}

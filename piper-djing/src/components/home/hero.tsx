import { Link } from '@tanstack/react-router'
import { DateChecker } from './date-checker.tsx'
import { LINKS, SCENES } from './content.ts'

export function Hero() {
  return (
    <section className="bp-full bp-pad">
      <img
        src={SCENES.hero}
        alt="A couple sharing their first dance while their guests look on"
        className="bp-bg"
        style={{ objectPosition: '50% 30%' }}
        fetchPriority="high"
      />
      <div className="bp-hero">
        <div>
          <p className="bp-k bp-pink">Brantford wedding DJ</p>
          <h1 className="bp-h1 mt-4">
            Hi, I’m <br />
            <span className="bp-pink">Piper P.</span>
          </h1>
          <p className="bp-hero__sub">The DJ who makes the night about you.</p>
          <p className="mt-3 max-w-xl leading-relaxed text-white/85">
            I bring big energy, a kind heart and a plan for everything. Serving
            Brantford, Hamilton, Cambridge, Paris and Brant County.
          </p>
          <div className="mt-7 flex flex-wrap gap-3">
            <a href="#check-a-date" className="bp-btn lg:hidden">
              Check a date
            </a>
            <Link to={LINKS.weddings} className="bp-btn bp-btn--line">
              Explore weddings
            </Link>
          </div>
          <p className="bp-hero__proof">
            <a href={LINKS.review} target="_blank" rel="noreferrer">
              <span aria-hidden="true" className="text-amber-300">
                ★★★★★{' '}
              </span>
              Google reviews
            </a>
            <a href="https://cpdja.ca" target="_blank" rel="noreferrer">
              Member of the Canadian Professional Disc Jockey Association
            </a>
          </p>
        </div>
        <DateChecker embedded />
      </div>
    </section>
  )
}

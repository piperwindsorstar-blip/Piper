import { Link } from '@tanstack/react-router'
import { LINKS, SCENES } from './content.ts'

export function FinalCta() {
  return (
    <section className="bp-full bp-cta bp-pad">
      <img src={SCENES.closing} alt="" className="bp-bg" loading="lazy" sizes="100vw" />
      <h2 className="bp-h1">
        Let’s make your <br />
        night <span className="bp-pink">yours.</span>
      </h2>
      <p className="mx-auto mt-5 max-w-lg text-lg font-semibold">
        Tell me about your event. There’s no pressure and no pushy sales talk,
        just a real conversation with a DJ who cares.
      </p>
      <div className="mt-8 flex flex-wrap justify-center gap-3">
        <a href="#check-a-date" className="bp-btn">
          Check a date
        </a>
        <Link to={LINKS.weddings} className="bp-btn bp-btn--line">
          Explore weddings
        </Link>
        <Link to={LINKS.book} className="bp-btn bp-btn--line">
          Plan your event
        </Link>
      </div>
      <a
        href={`mailto:${LINKS.email}`}
        className="mt-7 inline-flex min-h-11 items-center font-semibold underline underline-offset-4 hover:text-neon"
      >{`Email Piper: ${LINKS.email ?? ''}`}</a>
    </section>
  )
}

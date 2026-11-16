import { Link } from '@tanstack/react-router'
import { WORLDS } from './content.ts'

export function EventCards() {
  return (
    <section id="events" className="scroll-mt-24">
      <div className="bp-pad">
        <p className="bp-k bp-pink">Where you’ll find me</p>
        <h2 className="bp-h2 mt-3">
          Every kind of night. <span className="bp-pink">One standard.</span>
        </h2>
      </div>
      <div className="bp-quads">
        {WORLDS.map((world) => (
          <article key={world.t} className="bp-quad">
            <img
              src={world.img}
              alt=""
              loading="lazy"
              sizes="(min-width: 768px) 50vw, 100vw"
            />
            <h3 className="bp-quad__name">{world.t}</h3>
            <p>{world.d}</p>
            {'cta' in world ? (
              <div className="mt-5">
                <Link to={world.to} className="bp-btn bp-btn--small">
                  {world.cta}
                </Link>
              </div>
            ) : null}
            {'ext' in world ? (
              <a
                href={world.ext.h}
                target="_blank"
                rel="noreferrer"
                className="mt-4 self-start font-bold underline underline-offset-4 hover:text-neon"
              >
                {world.ext.l}
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

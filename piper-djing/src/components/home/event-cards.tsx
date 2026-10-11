import { WORLDS } from './content.ts'
import { Icon } from './icon.tsx'
import { ButtonPrimary, Eyebrow } from './ui.tsx'

export function EventCards() {
  return (
    <section id="events" className="mx-auto max-w-7xl scroll-mt-24 px-5 py-24">
      <Eyebrow>Where you’ll find me</Eyebrow>
      <h2 className="mt-4 max-w-3xl font-display text-4xl font-bold text-balance md:text-6xl">
        Every kind of night. One standard.
      </h2>
      <div className="mt-12 grid gap-5 md:grid-cols-2">
        {WORLDS.map((world) => (
          <article
            key={world.t}
            className={`group relative isolate flex min-h-[20rem] flex-col justify-end overflow-hidden rounded-3xl border p-8 transition duration-300 hover:-translate-y-1 ${
              'big' in world
                ? 'border-neon/60 shadow-[0_0_50px_rgba(255,0,127,0.22)] md:col-span-2 md:min-h-[26rem]'
                : 'border-white/10 hover:border-neon/50 hover:shadow-[0_0_40px_rgba(255,0,127,0.2)]'
            }`}
          >
            <img
              src={world.img}
              alt=""
              className="absolute inset-0 -z-10 h-full w-full object-cover transition duration-500 group-hover:scale-105"
              loading="lazy"
              sizes={
                'big' in world ? '100vw' : '(min-width: 768px) 50vw, 100vw'
              }
            />
            <div className="absolute inset-0 -z-10 bg-linear-to-t from-ink-950 via-ink-950/60 to-ink-950/10" />
            {'big' in world ? (
              <span className="mb-4 inline-block self-start rounded-full bg-neon px-3 py-1 font-mono text-[10px] tracking-widest uppercase">
                Most booked
              </span>
            ) : null}
            <h3
              className={`font-display font-extrabold ${'big' in world ? 'text-4xl md:text-6xl' : 'text-3xl'}`}
            >
              {world.t}
            </h3>
            <p className="mt-3 max-w-xl text-white/75">{world.d}</p>
            {'cta' in world ? (
              <div className="mt-6">
                <ButtonPrimary to={world.to}>{world.cta}</ButtonPrimary>
              </div>
            ) : null}
            {'ext' in world ? (
              <a
                href={world.ext.h}
                target="_blank"
                rel="noreferrer"
                className="mt-5 inline-flex items-center gap-2 self-start text-sm font-semibold text-hot hover:underline"
              >
                {world.ext.l}
                <Icon n="arrow" className="h-4 w-4" />
              </a>
            ) : null}
          </article>
        ))}
      </div>
    </section>
  )
}

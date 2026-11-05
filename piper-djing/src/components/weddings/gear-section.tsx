import { GEAR, PHOTOS } from './content.ts'
import { Eyebrow } from './ui.tsx'
import { Icon } from './icon.tsx'

export function GearSection() {
  return (
    <section
      id="the-booth"
      className="scroll-mt-24 border-y border-line bg-mist"
    >
      <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 py-24 lg:grid-cols-2">
        <div className="grid grid-cols-2 gap-3">
          <img
            src={PHOTOS.stack}
            alt="Speaker stack lit in pink"
            width={1024}
            height={1024}
            loading="lazy"
            sizes="(min-width: 1024px) 36rem, 100vw"
            className="col-span-2 aspect-[16/9] w-full rounded-xl border border-ink object-cover"
          />
          <img
            src={PHOTOS.mixer}
            alt="DJ mixer and headphones"
            width={1280}
            height={720}
            loading="lazy"
            sizes="(min-width: 1024px) 18rem, 50vw"
            className="aspect-square w-full rounded-xl border border-ink object-cover"
          />
          <img
            src={PHOTOS.beam}
            alt="Pink light beam on a dance floor"
            width={1152}
            height={864}
            loading="lazy"
            sizes="(min-width: 1024px) 18rem, 50vw"
            className="aspect-square w-full rounded-xl border border-ink object-cover"
          />
        </div>
        <div>
          <Eyebrow>The Booth & Gear</Eyebrow>
          <h2 className="mt-3 font-display text-4xl font-bold text-balance md:text-5xl">
            Sound that reaches the back row. Light that fills the room.
          </h2>
          <div className="mt-8 grid gap-px overflow-hidden rounded-xl border border-line bg-line sm:grid-cols-2">
            {GEAR.map((item) => (
              <div key={item.t} className="bg-paper p-5">
                <span className="grid h-10 w-10 place-items-center rounded-lg bg-ice text-violet">
                  <Icon n={item.i} />
                </span>
                <h3 className="mt-4 font-display text-lg font-bold text-balance">
                  {item.t}
                </h3>
                <p className="mt-1 text-sm text-soft">{item.d}</p>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}

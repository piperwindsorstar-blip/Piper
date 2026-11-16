import { ButtonPrimary } from './ui.tsx'

const UPLIGHTING_PHOTOS = [
  {
    src: '/photos/uplighting/uplighting-brick-wall.jpg',
    alt: 'Blue and pink uplighting on a brick venue wall',
  },
  {
    src: '/photos/uplighting/uplighting-reception-room.jpg',
    alt: 'Red and blue uplighting in a reception room',
  },
  {
    src: '/photos/uplighting/uplighting-dinner-setup.jpg',
    alt: 'Blue and purple uplighting at a set dinner reception',
  },
] as const

/** Uplighting showcase, under The Booth & Gear on /weddings. */
export function UplightingSection() {
  return (
    <section id="uplighting" className="scroll-mt-24" aria-labelledby="uplighting-title">
      <div className="mx-auto max-w-6xl px-5 py-24">
        <div className="max-w-2xl">
          <h2 id="uplighting-title" className="font-display text-4xl font-bold text-balance md:text-5xl">
            Light that changes the whole room.
          </h2>
          <p className="mt-5 text-lg text-soft">
            Uplighting washes the walls in your colours, so the room looks completely different from dinner to
            dancing. A few small lights on the floor, a big change in the feel of the night.
          </p>
          <p className="mt-4 text-lg text-soft">
            Wired uplights are $15 each. Tell me your colours when you check your date, and I'll build them into
            your night.
          </p>
          <div className="mt-8">
            <ButtonPrimary>Check Wedding Dates</ButtonPrimary>
          </div>
        </div>
        <div className="mt-12 grid grid-cols-2 gap-3 md:grid-cols-3">
          {UPLIGHTING_PHOTOS.map((photo, index) => (
            <img
              key={photo.src}
              src={photo.src}
              alt={photo.alt}
              width={1200}
              height={1600}
              loading="lazy"
              sizes="(min-width: 768px) 24rem, (min-width: 0px) 50vw"
              className={`w-full rounded-xl border border-ink object-cover ${
                index === 0 ? 'col-span-2 aspect-[4/3] md:col-span-1 md:aspect-[3/4]' : 'aspect-[3/4]'
              }`}
            />
          ))}
        </div>
      </div>
    </section>
  )
}

import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState, type RefObject } from 'react'
import {
  KIND_WORDS,
  PACKAGE_BUTTON_COPY,
  PUBLIC_EMAIL,
} from '../lib/crm/defaults.ts'
import { checkDate } from '../lib/crm/public.functions.ts'
import { professionalServiceJsonLd } from '../lib/seo.ts'
import { SiteFooter, SiteHeader, bigButton } from './site-frame.tsx'

const FAQ = [
  {
    q: 'Do you take requests during the reception?',
    a: 'The planning meeting is where the music for the night is set, including the songs you want and the ones you do not. Light MC for introducing speeches is part of a full wedding day or reception only, if you ask.',
  },
  {
    q: 'How far in advance should we book?',
    a: 'Check the date as soon as you have it. If that day is still open, inquire within. A date moves from open, to a hold, to booked, and once it is booked it stays yours.',
  },
  {
    q: 'What equipment do you bring, and do you have backup?',
    a: 'Reception packages include wireless microphones, two speakers, dancefloor lighting, and backup equipment. Ceremony only is one speaker, one wireless microphone for the officiant, and backup. No reception audio, no dancefloor lighting, and no MC.',
  },
  {
    q: 'Do you travel outside Brantford?',
    a: 'Yes. Travel is calculated from the kilometres to each venue and quoted apart from the package, along with a second venue and uplighting.',
  },
  {
    q: 'Our ceremony and reception are in different places. Is that okay?',
    a: 'Yes, up to two venues. A full wedding day covers ceremony audio at one venue and the reception at the other. The second venue is quoted apart from the package.',
  },
  {
    q: 'What happens at the planning meeting?',
    a: 'Every package includes at least one meeting. We go through the timeline, the names to announce, the songs for the big moments, and how the room is set up, so the night runs the way you want it to.',
  },
]

export function Landing() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(true)
  const openDate = () => dialog.current?.showModal()

  return (
    <div className="min-h-screen">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: professionalServiceJsonLd() }}
      />
      <SiteHeader onDate={openDate} />
      <main>
        <section className="mx-auto w-full max-w-6xl px-5 pt-16 md:px-8 md:pt-28">
          <h1 className="max-w-3xl font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            Brantford Wedding DJ & The Ultimate Dance Floor Experience
          </h1>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            You have dreamed of this day for months. Make sure the soundtrack
            matches the magic. Clean sound, a packed dance floor, and a night
            that runs on time, for weddings in Brantford, Hamilton, Cambridge,
            Paris, Brant County, and surrounding Ontario venues.
          </p>
          <div className="mt-8 flex flex-wrap gap-2">
            <Link
              to="/book"
              className="inline-flex min-h-11 items-center rounded-full bg-ink px-5 text-sm text-ivory focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
            >
              Check my date / Let's chat
            </Link>
            <button
              type="button"
              className="inline-flex min-h-11 items-center rounded-full border border-ink bg-ivory px-5 text-sm text-ink focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-ink"
              onClick={openDate}
            >
              Is my date open?
            </button>
          </div>
          <img
            src="/photos/logo-inverted.png"
            alt="Piper DJing"
            fetchPriority="high"
            className="mt-10 h-auto w-full max-w-2xl"
          />
        </section>
        <section className="mx-auto w-full max-w-6xl px-5 pt-12 md:px-8 md:pt-16">
          <h2 className="max-w-3xl font-display text-4xl tracking-tight sm:text-6xl">
            Behind the Booth: The Vibe, The Mix, The Memories
          </h2>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-ink-soft">
            DJ Piper at the decks, headphones on, reading the room. A great
            wedding night is put together on purpose: the walk down the aisle,
            the introductions, the speeches, and the last song everyone sings.
            Every part of it follows your energy.
          </p>
          <figure className="pt-8">
            <img
              src="/photos/dj-piper-at-the-booth.jpg"
              alt="DJ Piper at the booth, headphones on, with the DJ Piper P laptop."
              width={923}
              height={1232}
              className="mx-auto h-auto w-full max-w-md rounded-card"
            />
            <figcaption className="mt-4 max-w-3xl text-sm text-muted">
              DJ Piper at the booth, headphones on.
            </figcaption>
          </figure>
        </section>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 py-16 md:grid-cols-12 md:px-8 md:py-24">
          <div className="md:col-span-4">
            <h2 className="font-display text-5xl tracking-tight sm:text-6xl">
              The Party You've Been Dreaming Of
            </h2>
            <p className="mt-4 max-w-sm text-lg text-ink-soft">
              Shoes off, hands in the air, your favourite people around you, and
              a song the whole room knows. This is the part of the wedding
              everyone remembers.
            </p>
          </div>
          <figure className="md:col-span-8">
            <img
              src="/photos/wedding-reception-dance.jpg"
              alt="A bride dancing with guests under blue light at a wedding reception."
              width={1024}
              height={1024}
              loading="lazy"
              className="aspect-square w-full max-w-xl rounded-card object-cover"
            />
          </figure>
        </section>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 pb-16 md:grid-cols-12 md:px-8 md:pb-24">
          <div className="md:col-span-4">
            <h2 className="font-display text-5xl tracking-tight sm:text-6xl">
              Your First Dance, Perfectly Framed
            </h2>
            <p className="mt-4 max-w-sm text-lg text-ink-soft">
              The room falls away for a few minutes. Just the two of you under
              the lights, your song at the right volume, and everyone you love
              standing close enough to see it.
            </p>
          </div>
          <figure className="md:col-span-6 md:col-start-7">
            <img
              src="/photos/wedding-first-dance.jpg"
              alt="A bride and groom sharing their first dance, with wedding guests standing around them."
              width={1024}
              height={1024}
              loading="lazy"
              className="aspect-square w-full rounded-card object-cover"
            />
          </figure>
        </section>
        <section className="bg-ink text-ivory">
          <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-20">
            <h2 className="max-w-3xl font-display text-4xl tracking-tight sm:text-5xl">
              Premium Wedding DJ Services Across Southwestern Ontario
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-paper-deep">
              Dance floors in Brantford, Hamilton, Cambridge, Paris, Brant
              County, and beyond. A rustic barn, an urban loft, or a ballroom:
              sound, dancefloor lighting, and MC flow for the reception, set up
              for that room.
            </p>
            <ul
              className="mt-8 flex flex-wrap gap-2 text-sm"
              aria-label="Service area"
            >
              {[
                'Brantford',
                'Hamilton',
                'Cambridge',
                'Paris',
                'Brant County',
                'Surrounding Ontario',
              ].map((place) => (
                <li
                  key={place}
                  className="rounded-full border border-ivory/30 px-4 py-2"
                >
                  {place}
                </li>
              ))}
            </ul>
          </div>
        </section>
        <section
          className="border-t border-line"
          aria-label="Packages and inquiry"
        >
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-14 md:px-8 md:py-20">
            <button
              type="button"
              className={`${bigButton} border border-ink bg-ivory text-ink hover:bg-paper-deep`}
              aria-expanded={open}
              aria-controls="packages-panel"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="font-display text-2xl leading-tight">
                Simple packages, exceptional experience
              </span>
            </button>
            <div
              id="packages-panel"
              hidden={!open}
              className="scroll-mt-24 rounded-card border border-line bg-ivory px-6 py-8 md:px-10 md:py-12"
            >
              <h2 className="sr-only">
                Simple packages, exceptional experience
              </h2>
              <p className="max-w-prose text-sm leading-relaxed text-ink-soft">
                A full wedding day and reception only each include dancefloor
                lighting, at least one planning meeting, wireless microphones,
                backup, and light MC if you ask. A stag and doe includes MC
                duties. Ceremony only does not include reception audio,
                dancefloor lighting, or an MC.
              </p>
              <ul className="mt-6">
                {PACKAGE_BUTTON_COPY.map((item) => (
                  <li
                    key={item.id}
                    className="border-t border-line py-6 first:border-t-0 first:pt-0"
                  >
                    <h3 className="font-display text-2xl tracking-tight">
                      {item.name}
                    </h3>
                    <ul className="mt-3 grid gap-2 text-sm leading-relaxed text-ink-soft sm:grid-cols-2">
                      {item.includes.map((line) => (
                        <li key={line} className="flex gap-2">
                          <span
                            aria-hidden="true"
                            className="mt-2 size-1.5 shrink-0 rounded-full bg-ink"
                          />
                          {line}
                        </li>
                      ))}
                    </ul>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-line pt-6 text-sm text-muted">
                A full wedding day can include a stag and doe as one booking.
                Travel outside Brantford, a second venue, and uplighting are
                quoted apart from the package.
              </p>
            </div>
            <button
              type="button"
              className={`${bigButton} border border-ink bg-ivory text-ink hover:bg-paper-deep`}
              onClick={openDate}
            >
              <span className="font-display text-2xl leading-tight">
                Check your date
              </span>
            </button>
            <Link
              to="/book"
              className={`${bigButton} bg-ink text-ivory hover:bg-ink-soft`}
            >
              <span className="font-display text-2xl leading-tight">
                Secure your date
              </span>
              <span className="text-sm">Inquire within</span>
            </Link>
          </div>
        </section>
        <section
          className="bg-ink text-ivory"
          aria-labelledby="kind-words-title"
        >
          <div className="mx-auto w-full max-w-6xl px-5 py-16 md:px-8 md:py-20">
            <h2
              id="kind-words-title"
              className="font-display text-4xl tracking-tight sm:text-5xl"
            >
              Kind Words
            </h2>
            <p className="mt-4 max-w-2xl text-lg leading-relaxed text-paper-deep">
              From the couples who danced the night away.
            </p>
            <ul className="mt-10 grid gap-5 md:grid-cols-3">
              {KIND_WORDS.map((word, index) => (
                <li
                  key={index}
                  className="flex flex-col justify-between rounded-card border border-ivory/20 bg-ink-soft px-6 py-8"
                >
                  {word.quote ? (
                    <>
                      <blockquote className="font-display text-xl leading-snug tracking-tight">
                        “{word.quote}”
                      </blockquote>
                      <footer className="mt-6 text-sm text-paper-deep">
                        {word.names}
                        {word.when ? (
                          <span className="block text-ivory/60">
                            {word.when}
                          </span>
                        ) : null}
                      </footer>
                    </>
                  ) : (
                    <>
                      <p className="font-display text-xl leading-snug tracking-tight text-ivory/70">
                        This space is saved for a couple's kind words.
                      </p>
                      <p className="mt-6 text-sm text-ivory/60">
                        Brantford wedding, coming soon
                      </p>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <p className="mt-8 text-sm text-paper-deep">
              Danced at a wedding with Piper? Send a few words to{' '}
              <a
                href={`mailto:${PUBLIC_EMAIL}`}
                className="underline underline-offset-4"
              >
                {PUBLIC_EMAIL}
              </a>
              .
            </p>
          </div>
        </section>
        <section
          className="mx-auto w-full max-w-3xl px-5 py-16 md:px-8 md:py-20"
          aria-labelledby="faq-title"
        >
          <h2
            id="faq-title"
            className="font-display text-4xl tracking-tight sm:text-5xl"
          >
            Questions couples ask
          </h2>
          <div className="mt-8 border-b border-line">
            {FAQ.map((item) => (
              <details key={item.q} className="group border-t border-line py-5">
                <summary className="flex cursor-pointer list-none items-center justify-between gap-4 font-display text-2xl tracking-tight [&::-webkit-details-marker]:hidden">
                  {item.q}
                  <span
                    aria-hidden="true"
                    className="shrink-0 text-xl text-muted transition-transform duration-150 group-open:rotate-45"
                  >
                    +
                  </span>
                </summary>
                <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </section>
      </main>
      <SiteFooter />
      <DateDialog dialog={dialog} />
    </div>
  )
}

function DateDialog({
  dialog,
}: {
  dialog: RefObject<HTMLDialogElement | null>
}) {
  const check = useServerFn(checkDate)
  const [result, setResult] = useState<string | null>(null)

  return (
    <dialog id="date-check" ref={dialog} aria-labelledby="date-check-title">
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          const date = String(
            new FormData(event.currentTarget).get('date') ?? '',
          )
          void check({ data: { date } })
            .then((answer) =>
              setResult(
                answer.open ? 'That date is open.' : 'That date is taken.',
              ),
            )
            .catch(() => setResult('Choose a date.'))
        }}
      >
        <h2
          id="date-check-title"
          className="font-display text-3xl tracking-tight"
        >
          Is that date open?
        </h2>
        <label className="field">
          Wedding date
          <input name="date" type="date" required />
        </label>
        <button type="submit" className={`${bigButton} bg-ink text-ivory`}>
          <span className="font-display text-xl">Check the date</span>
        </button>
        {result ? <p className="text-center text-lg">{result}</p> : null}
        <button
          type="button"
          className="text-sm text-muted"
          onClick={() => dialog.current?.close()}
        >
          Close
        </button>
      </form>
    </dialog>
  )
}

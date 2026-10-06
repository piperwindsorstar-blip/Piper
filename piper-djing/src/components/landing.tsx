import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState, type RefObject } from 'react'
import { PACKAGE_BUTTON_COPY } from '../lib/crm/defaults.ts'
import { checkDate } from '../lib/crm/public.functions.ts'
import { professionalServiceJsonLd } from '../lib/seo.ts'
import { SiteFooter, SiteHeader, bigButton } from './site-frame.tsx'

export function Landing() {
  const dialog = useRef<HTMLDialogElement>(null)
  const [open, setOpen] = useState(false)
  const openDate = () => dialog.current?.showModal()

  return (
    <div className="min-h-screen">
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: professionalServiceJsonLd() }} />
      <SiteHeader onDate={openDate} />
      <main>
        <section className="mx-auto w-full max-w-6xl px-5 pt-16 md:px-8 md:pt-28">
          <img src="/photos/logo-inverted.png" alt="Piper DJing" className="h-auto w-full max-w-2xl" />
          <h1 className="mt-8 max-w-3xl font-display text-4xl leading-tight tracking-tight sm:text-5xl">
            Wedding DJ in Brantford, Ontario
          </h1>
          <p className="mt-6 max-w-2xl font-display text-2xl leading-tight tracking-tight text-ink-soft sm:text-4xl">
            The night they will still be talking about.
          </p>
          <p className="mt-6 max-w-2xl text-lg leading-relaxed text-ink-soft">
            Piper DJing is a Brantford wedding DJ for ceremonies, receptions and full wedding days across
            Brantford, Hamilton, Cambridge, Paris and Brant County and surrounding areas in Ontario. Dancefloor
            lighting, at least one planning meeting and light MC duties come with every reception.
          </p>
        </section>
        <figure className="pt-12 md:pt-16">
          <img
            src="/photos/spotlight.jpg"
            alt="A couple dancing alone in a single shaft of gold light, guests standing in a dark ring around them."
            className="aspect-3/2 w-full object-cover"
          />
          <figcaption className="mx-auto mt-4 w-full max-w-6xl px-5 text-sm text-muted md:px-8">
            Lights down. One song. The whole room watching.
          </figcaption>
        </figure>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 py-16 md:grid-cols-12 md:px-8 md:py-24">
          <div className="md:col-span-4">
            <h2 className="font-display text-5xl tracking-tight sm:text-6xl">On their feet</h2>
            <p className="mt-4 max-w-xs text-lg text-ink-soft">Dinner ends. Chairs empty. This is the part they came for.</p>
          </div>
          <figure className="md:col-span-8">
            <img
              src="/photos/dance.jpg"
              alt="A crowded wedding dance floor in warm light, gowns and black tie in motion, faces turned away."
              className="aspect-3/2 w-full rounded-card object-cover"
            />
          </figure>
        </section>
        <section className="mx-auto grid w-full max-w-6xl items-center gap-8 px-5 pb-16 md:grid-cols-12 md:px-8 md:pb-24">
          <figure className="md:col-span-6 md:col-start-7 md:order-2">
            <img
              src="/photos/spin.jpg"
              alt="The hem of a wedding dress mid-spin above a dark floor, a gold streak of light, a chandelier behind."
              className="aspect-2/3 w-full rounded-card object-cover"
            />
          </figure>
          <div className="md:order-1 md:col-span-4">
            <h2 className="font-display text-5xl tracking-tight sm:text-6xl">The last song</h2>
            <p className="mt-4 max-w-xs text-lg text-ink-soft">Nobody reaches for a coat. Play it that way.</p>
          </div>
        </section>
        <section className="border-t border-line" aria-label="Packages and inquiry">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4 px-5 py-14 md:px-8 md:py-20">
            <button
              type="button"
              className={`${bigButton} border border-ink bg-ivory text-ink hover:bg-paper-deep`}
              aria-expanded={open}
              aria-controls="packages-panel"
              onClick={() => setOpen((value) => !value)}
            >
              <span className="font-display text-2xl leading-tight">Packages and pricing</span>
            </button>
            <div
              id="packages-panel"
              hidden={!open}
              className="scroll-mt-24 rounded-card border border-line bg-ivory px-6 py-8 md:px-10 md:py-12"
            >
              <h2 className="sr-only">Packages and pricing</h2>
              <ul className="mt-2">
                {PACKAGE_BUTTON_COPY.map((item) => (
                  <li key={item.id} className="border-t border-line py-6 first:border-t-0 first:pt-0">
                    <h3 className="font-display text-2xl tracking-tight">{item.name}</h3>
                    <p className="mt-3 max-w-prose text-sm leading-relaxed text-ink-soft">{item.detail}</p>
                  </li>
                ))}
              </ul>
              <p className="mt-2 border-t border-line pt-6 text-sm text-muted">
                A full wedding day can include a stag and doe as one booking. Travel from Brantford, a second
                venue, and uplights are quoted apart from the package.
              </p>
            </div>
            <button
              type="button"
              className={`${bigButton} border border-ink bg-ivory text-ink hover:bg-paper-deep`}
              onClick={openDate}
            >
              <span className="font-display text-2xl leading-tight">Is My Date Available?</span>
            </button>
            <Link to="/book" className={`${bigButton} bg-ink text-ivory hover:bg-ink-soft`}>
              <span className="font-display text-2xl leading-tight">Book me</span>
              <span className="text-sm">Inquire within</span>
            </Link>
          </div>
        </section>
      </main>
      <SiteFooter />
      <DateDialog dialog={dialog} />
    </div>
  )
}

function DateDialog({ dialog }: { dialog: RefObject<HTMLDialogElement | null> }) {
  const check = useServerFn(checkDate)
  const [result, setResult] = useState<string | null>(null)

  return (
    <dialog id="date-check" ref={dialog} aria-labelledby="date-check-title">
      <form
        className="grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          const date = String(new FormData(event.currentTarget).get('date') ?? '')
          void check({ data: { date } })
            .then((answer) => setResult(answer.open ? 'That date is open.' : 'That date is taken.'))
            .catch(() => setResult('Choose a date.'))
        }}
      >
        <h2 id="date-check-title" className="font-display text-3xl tracking-tight">
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
        <button type="button" className="text-sm text-muted" onClick={() => dialog.current?.close()}>
          Close
        </button>
      </form>
    </dialog>
  )
}

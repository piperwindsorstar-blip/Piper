import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { DateCalendarDialog } from '../components/weddings/date-calendar.tsx'
import { DateDraftProvider } from '../components/weddings/date-draft.tsx'
import { Header } from '../components/weddings/header.tsx'
import { SiteFooter } from '../components/weddings/site-footer.tsx'
import { EVENT_TYPES } from '../lib/crm/date-request.ts'
import { publicPackagePrice } from '../lib/crm/packages.ts'
import { getPublicSite, sendInquiry } from '../lib/crm/public.functions.ts'
import { PACKAGE_CENTS } from '../lib/piper/rules.ts'
import { publicHead } from '../lib/seo.ts'
import type { PackageId } from '../lib/crm/defaults.ts'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap'

const PACKAGE_TITLES: Record<PackageId, string> = {
  full: 'The Main Event (Full Wedding Day',
  reception: 'The After Party (Reception Only',
  stag: 'The Pre-Party (Stag and Doe',
  ceremony: 'The Aisle (Ceremony Only',
}

export const Route = createFileRoute('/book')({
  validateSearch: (
    search: Record<string, unknown>,
  ): { date?: string; event?: string } => {
    const found: { date?: string; event?: string } = {}
    if (
      typeof search.date === 'string' &&
      /^\d{4}-\d{2}-\d{2}$/.test(search.date)
    ) {
      found.date = search.date
    }
    if (
      typeof search.event === 'string' &&
      (EVENT_TYPES as readonly string[]).includes(search.event)
    ) {
      found.event = search.event
    }
    return found
  },
  head: () => {
    const head = publicHead({
      path: '/book',
      title: 'Book a wedding DJ in Brantford | Piper DJing',
    })
    return {
      ...head,
      links: [...head.links, { rel: 'stylesheet', href: FONTS }],
      meta: [...head.meta, { name: 'theme-color', content: '#FFFFFF' }],
    }
  },
  loader: () => getPublicSite(),
  component: BookPage,
})

const field =
  'mt-2 w-full rounded-lg border border-line bg-mist px-4 py-3 text-ink focus:border-violet focus:bg-paper focus:outline-none'

const PACKAGE_FOR_EVENT: Record<string, string> = {
  Wedding: 'full',
  'Stag and doe': 'stag',
  'Ceremony only': 'ceremony',
}

function BookPage() {
  const { packages } = Route.useLoaderData()
  const { date: requestedDate = '', event: requestedEvent = '' } =
    Route.useSearch()
  const packageChoices = (
    ['full', 'reception', 'stag', 'ceremony'] as const
  ).map((id) => {
    const cents =
      packages.find((item) => item.id === id)?.cents ?? PACKAGE_CENTS[id]
    return {
      id,
      label: `${PACKAGE_TITLES[id]}, ${publicPackagePrice(id, cents)})`,
    }
  })
  const send = useServerFn(sendInquiry)
  const [packageId, setPackageId] = useState(
    () => PACKAGE_FOR_EVENT[requestedEvent] ?? 'full',
  )
  useEffect(() => {
    const next = PACKAGE_FOR_EVENT[requestedEvent]
    if (next) setPackageId(next)
  }, [requestedEvent])
  const [withStag, setWithStag] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)

  return (
    <DateDraftProvider>
      <div className="weddings min-h-screen overflow-x-clip bg-paper font-sans text-ink">
        <Header sectionBase="/weddings" />
        <DateCalendarDialog />
        <main className="mx-auto w-full max-w-xl px-5 py-16">
          <p className="font-mono text-xs tracking-[0.22em] text-violet uppercase">
            Weddings
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-balance md:text-5xl">
            Book me
          </h1>
          <p className="mt-4 text-lg text-soft">
            Tell Piper the date. The reply comes by email.
          </p>
          {done ? (
            <p className="mt-10 font-display text-3xl font-bold tracking-tight">
              {message}
            </p>
          ) : (
            <form
              className="mt-10 grid gap-4 rounded-2xl border border-ink bg-paper p-7 shadow-[8px_8px_0_0_#EEE8FF]"
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                void send({
                  data: {
                    partnerOne: String(form.get('partnerOne') ?? ''),
                    partnerTwo: String(form.get('partnerTwo') ?? ''),
                    email: String(form.get('email') ?? ''),
                    phone: String(form.get('phone') ?? ''),
                    eventDate: String(form.get('eventDate') ?? ''),
                    packageId: String(form.get('packageId') ?? ''),
                    withStag: form.get('withStag') === 'on',
                    stagDate: String(form.get('stagDate') ?? ''),
                    message: String(form.get('message') ?? ''),
                  },
                })
                  .then((result) => {
                    if (!result.ok) {
                      setMessage(result.error)
                      return
                    }
                    setDone(true)
                    setMessage(
                      result.unavailable
                        ? 'That date is already held. Piper has your note.'
                        : 'Thank you. Piper will write back.',
                    )
                  })
                  .catch(() => {
                    setMessage('That inquiry was not saved.')
                  })
              }}
            >
              <label className="text-sm font-medium">
                First partner
                <input
                  name="partnerOne"
                  required
                  autoComplete="given-name"
                  className={field}
                />
              </label>
              <label className="text-sm font-medium">
                Second partner
                <input name="partnerTwo" required className={field} />
              </label>
              <label className="text-sm font-medium">
                Email
                <input
                  name="email"
                  type="email"
                  required
                  autoComplete="email"
                  className={field}
                />
              </label>
              <label className="text-sm font-medium">
                Phone
                <input
                  name="phone"
                  type="tel"
                  autoComplete="tel"
                  className={field}
                />
              </label>
              <label className="text-sm font-medium">
                Wedding date
                <input
                  key={requestedDate}
                  name="eventDate"
                  type="date"
                  required
                  defaultValue={requestedDate}
                  className={field}
                />
              </label>
              <label className="text-sm font-medium">
                Package
                <select
                  name="packageId"
                  value={packageId}
                  className={field}
                  onChange={(event) => {
                    setPackageId(event.target.value)
                    if (event.target.value !== 'full') setWithStag(false)
                  }}
                >
                  {packageChoices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {packageId === 'full' ? (
                <div className="grid gap-2">
                  <label className="flex items-center gap-3 text-sm">
                    <input
                      name="withStag"
                      type="checkbox"
                      className="size-5 accent-neon"
                      checked={withStag}
                      onChange={(event) => setWithStag(event.target.checked)}
                    />
                    Add a stag and doe on its own date
                  </label>
                  <p className="text-sm text-soft">
                    The Main Event and The Pre-Party booked together get $250
                    off.
                  </p>
                </div>
              ) : null}
              {withStag ? (
                <label className="text-sm font-medium">
                  Stag and doe date
                  <input
                    name="stagDate"
                    type="date"
                    required
                    className={field}
                  />
                </label>
              ) : null}
              <label className="text-sm font-medium">
                Note
                <textarea
                  name="message"
                  rows={4}
                  className={field}
                  defaultValue={
                    requestedEvent && !(requestedEvent in PACKAGE_FOR_EVENT)
                      ? requestedEvent
                      : ''
                  }
                />
              </label>
              {message ? (
                <p className="text-sm text-danger">{message}</p>
              ) : null}
              <button
                type="submit"
                className="inline-flex min-h-12 items-center justify-center rounded-lg bg-neon px-7 py-3.5 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(255,0,127,0.6)] transition hover:bg-hot"
              >
                Send the inquiry
              </button>
            </form>
          )}
        </main>
        <SiteFooter />
      </div>
    </DateDraftProvider>
  )
}

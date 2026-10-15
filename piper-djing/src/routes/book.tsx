import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ActionButton } from '../components/action-button.tsx'
import type { RunResult } from '../components/action-button.tsx'
import { useEffect, useState, useRef } from 'react'
import { DateCalendarDialog } from '../components/weddings/date-calendar.tsx'
import { DateDraftProvider } from '../components/weddings/date-draft.tsx'
import { Header } from '../components/weddings/header.tsx'
import { SiteFooter } from '../components/weddings/site-footer.tsx'
import { publicPackagePrice } from '../lib/crm/packages.ts'
import {
  estimateTravel,
  getPublicSite,
  sendEventInquiry,
  sendInquiry,
} from '../lib/crm/public.functions.ts'
import { cad } from '../lib/crm/money.ts'
import { PACKAGE_CENTS } from '../lib/piper/rules.ts'
import { WEDDING_OG_IMAGE, publicHead } from '../lib/seo.ts'
import type { PackageId } from '../lib/crm/defaults.ts'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap'

const PACKAGE_TITLES: Record<PackageId, string> = {
  full: 'The Main Event (Full Wedding Day',
  reception: 'The After Party (Reception Only',
  stag: 'The Pre-Party (Stag and Doe',
  ceremony: 'The Aisle (Ceremony Only',
  custom: 'Custom event',
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
    if (typeof search.event === 'string') {
      const event = search.event.trim()
      if (event.length > 0 && event.length <= 80 && !/[\r\n]/.test(event)) {
        found.event = event
      }
    }
    return found
  },
  head: () => {
    const head = publicHead({
      path: '/book',
      title: 'Book a wedding DJ in Brantford | DJ Piper P',
    })
    return {
      ...head,
      links: [...head.links, { rel: 'stylesheet', href: FONTS }],
      meta: [
        ...head.meta.map((item) =>
          'property' in item && item.property === 'og:image'
            ? { property: 'og:image', content: WEDDING_OG_IMAGE }
            : item,
        ),
        { name: 'theme-color', content: '#FFFFFF' },
      ],
    }
  },
  loader: () => getPublicSite(),
  staleTime: 5 * 60 * 1000,
  component: BookPage,
})

const field =
  'mt-2 w-full rounded-lg border border-line bg-mist px-4 py-3 text-ink focus:border-violet focus:bg-paper focus:outline-none'

const PACKAGE_FOR_EVENT: Record<string, string> = {
  Wedding: 'full',
  'Stag and doe': 'stag',
  'Ceremony only': 'ceremony',
}

const STAG_ELIGIBLE = new Set(['full', 'reception', 'custom'])

const WEDDING_INQUIRY = new Set([
  '',
  'Wedding',
  'Stag and doe',
  'Ceremony only',
  'Anniversary',
])

function BookPage() {
  const { packages } = Route.useLoaderData()
  const { date: requestedDate = '', event: requestedEvent = '' } =
    Route.useSearch()
  const packageChoices = (
    ['full', 'reception', 'stag', 'ceremony', 'custom'] as const
  ).map((id) => {
    if (id === 'custom') return { id, label: 'Custom event' }
    const cents =
      packages.find((item) => item.id === id)?.cents ?? PACKAGE_CENTS[id]
    return {
      id,
      label: `${PACKAGE_TITLES[id]}, ${publicPackagePrice(id, cents)})`,
    }
  })
  const send = useServerFn(sendInquiry)
  const sendEvent = useServerFn(sendEventInquiry)
  const general = !WEDDING_INQUIRY.has(requestedEvent)
  const [packageId, setPackageId] = useState(
    () => PACKAGE_FOR_EVENT[requestedEvent] ?? 'full',
  )
  useEffect(() => {
    const next = PACKAGE_FOR_EVENT[requestedEvent]
    if (next) setPackageId(next)
  }, [requestedEvent])
  const [withStag, setWithStag] = useState(false)
  const [venueStreet, setVenueStreet] = useState('')
  const [secondVenue, setSecondVenue] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [done, setDone] = useState(false)
  const eventForm = useRef<HTMLFormElement | null>(null)
  const weddingForm = useRef<HTMLFormElement | null>(null)

  /** The event inquiry: a message to the couple, never a number. */
  async function sendTheEvent(form: FormData): Promise<RunResult> {
    const result = await sendEvent({
      data: {
        name: String(form.get('name') ?? ''),
        email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? ''),
        eventDate: String(form.get('eventDate') ?? ''),
        event: requestedEvent,
        message: String(form.get('message') ?? ''),
      },
    })
    if (!result.ok) {
      setMessage(result.error)
      return { ok: false, message: result.error }
    }
    setDone(true)
    setMessage(
      result.unavailable
        ? 'That date is already held. Piper has your note.'
        : 'Thank you. Piper will write back.',
    )
    return { ok: true, message: 'Sent.' }
  }

  /** The wedding inquiry: names, date, package and both venues. */
  async function sendTheWedding(form: FormData): Promise<RunResult> {
    const joined = (first: string, last: string) =>
      [first.trim(), last.trim()].filter(Boolean).join(' ')
    const result = await send({
      data: {
        partnerOne: joined(
          String(form.get('partnerOneFirst') ?? ''),
          String(form.get('partnerOneLast') ?? ''),
        ),
        partnerTwo: joined(
          String(form.get('partnerTwoFirst') ?? ''),
          String(form.get('partnerTwoLast') ?? ''),
        ),
        email: String(form.get('email') ?? ''),
        phone: String(form.get('phone') ?? ''),
        eventDate: String(form.get('eventDate') ?? ''),
        packageId: String(form.get('packageId') ?? ''),
        withStag: form.get('withStag') === 'on',
        stagDate: String(form.get('stagDate') ?? ''),
        venueName: String(form.get('venueName') ?? ''),
        venueStreet: String(form.get('venueStreet') ?? ''),
        venueTwoName: String(form.get('venueTwoName') ?? ''),
        venueTwoStreet: String(form.get('venueTwoStreet') ?? ''),
        referral: String(form.get('referral') ?? ''),
        message: String(form.get('message') ?? ''),
      },
    })
    if (!result.ok) {
      setMessage(result.error)
      return { ok: false, message: result.error }
    }
    setDone(true)
    setMessage(
      result.unavailable
        ? 'That date is already held. Piper has your note.'
        : 'Thank you. Piper will write back.',
    )
    return { ok: true, message: 'Sent.' }
  }

  return (
    <DateDraftProvider>
      <div className="weddings min-h-screen overflow-x-clip bg-paper font-sans text-ink">
        <Header sectionBase="/weddings" />
        <DateCalendarDialog />
        <main className="mx-auto w-full max-w-xl px-5 py-16">
          <p className="font-mono text-xs tracking-[0.22em] text-violet uppercase">
            {general ? 'Events' : 'Weddings'}
          </p>
          <h1 className="mt-3 font-display text-4xl font-bold tracking-tight text-balance md:text-5xl">
            Book your Brantford wedding DJ
          </h1>
          <p className="mt-4 text-lg text-soft">
            Welcome to your first step of finding a DJ that truly cares about
            every aspect of your wedding.
          </p>
          {requestedDate && !done ? (
            <p className="mt-6 rounded-xl border border-neon/40 bg-neon/10 px-4 py-3 text-lg font-semibold">
              {openDateLabel(requestedDate)} is open. Tell Piper a little more
              and the reply comes by email.
            </p>
          ) : (
            <p className="mt-2 text-lg text-soft">
              Tell Piper the date. The reply comes by email.
            </p>
          )}
          {done ? (
            <p className="mt-10 font-display text-3xl font-bold tracking-tight">
              {message}
            </p>
          ) : general ? (
            <form
              ref={eventForm}
              className="mt-10 grid gap-4 rounded-2xl border border-ink bg-paper p-7 shadow-[8px_8px_0_0_#EEE8FF]"
              onSubmit={(event) => {
                event.preventDefault()
                void sendTheEvent(new FormData(event.currentTarget))
              }}
            >
              <p className="font-display text-2xl font-bold">
                {requestedEvent}
              </p>
              <label className="text-sm font-medium">
                Your name
                <input
                  name="name"
                  required
                  autoComplete="name"
                  className={field}
                />
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
                Date
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
                Note
                <textarea name="message" rows={4} className={field} />
              </label>
              {message ? (
                <p className="text-sm text-danger">{message}</p>
              ) : null}
              <ActionButton
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-neon px-7 py-3.5 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(255,0,127,0.6)]"
                wrapperClassName="grid"
                busy="Sending…"
                done="Sent"
                surface="light"
                onRun={async (): Promise<RunResult> => {
                  const form = eventForm.current
                  if (!form) return { ok: false, message: 'Try again.' }
                  if (!form.reportValidity()) {
                    return { ok: false, message: 'Fill in the fields above.' }
                  }
                  return sendTheEvent(new FormData(form))
                }}
              >
                Send the inquiry
              </ActionButton>
            </form>
          ) : (
            <form
              ref={weddingForm}
              className="mt-10 grid gap-4 rounded-2xl border border-ink bg-paper p-7 shadow-[8px_8px_0_0_#EEE8FF]"
              onSubmit={(event) => {
                event.preventDefault()
                void sendTheWedding(new FormData(event.currentTarget))
              }}
            >
              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="text-sm font-medium">First partner</legend>
                <label className="text-sm font-medium">
                  First name
                  <input
                    name="partnerOneFirst"
                    required
                    autoComplete="given-name"
                    className={field}
                  />
                </label>
                <label className="text-sm font-medium">
                  Last name
                  <input
                    name="partnerOneLast"
                    required
                    autoComplete="family-name"
                    className={field}
                  />
                </label>
              </fieldset>
              <fieldset className="grid gap-4 sm:grid-cols-2">
                <legend className="text-sm font-medium">Second partner</legend>
                <label className="text-sm font-medium">
                  First name
                  <input
                    name="partnerTwoFirst"
                    required
                    autoComplete="given-name"
                    className={field}
                  />
                </label>
                <label className="text-sm font-medium">
                  Last name
                  <input
                    name="partnerTwoLast"
                    required
                    autoComplete="family-name"
                    className={field}
                  />
                </label>
              </fieldset>
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
                  required
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
                Venue name
                <span className="block text-xs font-normal text-soft">
                  Not booked yet? Leave the venue blank.
                </span>
                <input name="venueName" className={field} />
              </label>
              <label className="text-sm font-medium">
                Venue street address
                <input
                  name="venueStreet"
                  autoComplete="street-address"
                  className={field}
                  onChange={(event) => setVenueStreet(event.target.value)}
                />
              </label>
              <label className="text-sm font-medium">
                Second (ceremony) venue name — optional
                <input
                  name="venueTwoName"
                  className={field}
                  onChange={(event) => {
                    const form = event.currentTarget.form
                    setSecondVenue(
                      Boolean(
                        event.target.value.trim() ||
                          String(new FormData(form ?? undefined).get('venueTwoStreet') ?? '').trim(),
                      ),
                    )
                  }}
                />
              </label>
              <label className="text-sm font-medium">
                Second (ceremony) venue address — optional
                <input
                  name="venueTwoStreet"
                  className={field}
                  onChange={(event) => {
                    const form = event.currentTarget.form
                    setSecondVenue(
                      Boolean(
                        event.target.value.trim() ||
                          String(new FormData(form ?? undefined).get('venueTwoName') ?? '').trim(),
                      ),
                    )
                  }}
                />
              </label>
              <p className="text-sm text-soft">
                A separate ceremony venue adds a $75 second-venue fee.
              </p>
              <label className="text-sm font-medium">
                Package
                <select
                  name="packageId"
                  value={packageId}
                  className={field}
                  onChange={(event) => {
                    const next = event.target.value
                    setPackageId(next)
                    if (!STAG_ELIGIBLE.has(next)) setWithStag(false)
                  }}
                >
                  {packageChoices.map((item) => (
                    <option key={item.id} value={item.id}>
                      {item.label}
                    </option>
                  ))}
                </select>
              </label>
              {STAG_ELIGIBLE.has(packageId) ? (
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
              <PriceEstimate
                packageId={packageId}
                withStag={withStag}
                venueStreet={venueStreet}
                secondVenue={secondVenue}
                prices={Object.fromEntries(
                  packageChoices.map((item) => [
                    item.id,
                    packages.find((offer) => offer.id === item.id)?.cents ??
                      PACKAGE_CENTS[item.id],
                  ]),
                )}
              />
              <label className="text-sm font-medium">
                Did someone refer you? If so, who? — optional
                <input name="referral" className={field} />
              </label>
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
              <ActionButton
                className="inline-flex min-h-12 items-center justify-center gap-2 rounded-lg bg-neon px-7 py-3.5 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(255,0,127,0.6)]"
                wrapperClassName="grid"
                busy="Sending…"
                done="Sent"
                surface="light"
                onRun={async (): Promise<RunResult> => {
                  const form = weddingForm.current
                  if (!form) return { ok: false, message: 'Try again.' }
                  if (!form.reportValidity()) {
                    return { ok: false, message: 'Fill in the fields above.' }
                  }
                  return sendTheWedding(new FormData(form))
                }}
              >
                Send the inquiry
              </ActionButton>
            </form>
          )}
        </main>
        <SiteFooter />
      </div>
    </DateDraftProvider>
  )
}

type TravelEstimate =
  | { state: 'idle' }
  | { state: 'working' }
  | { state: 'ready'; feeCents: number; hotel: boolean }
  | { state: 'unknown' }

/**
 * The price estimate: package, stag, second venue and travel, worked out
 * from the venue address once it is typed. Travel comes from the server.
 */
function PriceEstimate({
  packageId,
  withStag,
  venueStreet,
  secondVenue,
  prices,
}: {
  packageId: string
  withStag: boolean
  venueStreet: string
  secondVenue: boolean
  prices: Record<string, number>
}) {
  const estimate = useServerFn(estimateTravel)
  const [travel, setTravel] = useState<TravelEstimate>({ state: 'idle' })
  const address = venueStreet.trim()

  useEffect(() => {
    if (address.length < 6 || packageId === 'custom') {
      setTravel({ state: 'idle' })
      return
    }
    let stale = false
    setTravel({ state: 'working' })
    const timer = window.setTimeout(() => {
      void estimate({ data: { address, packageId } })
        .then((result) => {
          if (stale) return
          setTravel(
            result.ok
              ? { state: 'ready', feeCents: result.feeCents, hotel: result.hotel }
              : { state: 'unknown' },
          )
        })
        .catch(() => {
          if (!stale) setTravel({ state: 'unknown' })
        })
    }, 900)
    return () => {
      stale = true
      window.clearTimeout(timer)
    }
  }, [address, packageId, estimate])

  if (packageId === 'custom') {
    return (
      <p className="rounded-lg bg-mist px-4 py-3 text-sm text-soft">
        Piper sends a custom price for this one.
      </p>
    )
  }
  const lines: [string, number][] = [[PACKAGE_TITLES_SHORT[packageId] ?? 'Package', prices[packageId] ?? 0]]
  if (withStag && (packageId === 'full' || packageId === 'reception')) {
    lines.push(['The Pre-Party (stag and doe)', prices.stag ?? 0])
    if (packageId === 'full') lines.push(['Main Event + Pre-Party together', -25000])
  }
  if (secondVenue && (packageId === 'full' || packageId === 'reception')) {
    lines.push(['Separate ceremony venue', 7500])
  }
  const travelCents = travel.state === 'ready' ? travel.feeCents : 0
  const total = lines.reduce((sum, [, cents]) => sum + cents, 0) + travelCents
  return (
    <section
      aria-label="Price estimate"
      aria-live="polite"
      className="rounded-xl border border-line bg-mist px-4 py-4 text-sm"
    >
      <p className="font-semibold">Your estimate</p>
      <dl className="mt-2 grid gap-1">
        {lines.map(([label, cents]) => (
          <div key={label} className="flex justify-between gap-3">
            <dt className="text-soft">{label}</dt>
            <dd className="tabular-nums">{cents < 0 ? `−${cad(-cents)}` : cad(cents)}</dd>
          </div>
        ))}
        <div className="flex justify-between gap-3">
          <dt className="text-soft">Travel</dt>
          <dd className="tabular-nums">
            {packageId === 'ceremony'
              ? 'Included'
              : address.length < 6
                ? 'Add the venue address'
                : travel.state === 'working'
                  ? 'Working it out…'
                  : travel.state === 'ready'
                    ? travel.feeCents === 0
                      ? 'Included'
                      : cad(travel.feeCents)
                    : 'Piper will confirm'}
          </dd>
        </div>
        <div className="mt-1 flex justify-between gap-3 border-t border-line pt-2 font-semibold">
          <dt>Estimated total</dt>
          <dd className="tabular-nums">{cad(total)}</dd>
        </div>
      </dl>
      {travel.state === 'ready' && travel.hotel ? (
        <p className="mt-2 text-soft">That far out, a hotel night is added. Piper will confirm it with you.</p>
      ) : null}
      <p className="mt-2 text-xs text-soft">Travel based on driving distance from Brantford.</p>
    </section>
  )
}

const PACKAGE_TITLES_SHORT: Record<string, string> = {
  full: 'The Main Event',
  reception: 'The After Party',
  stag: 'The Pre-Party',
  ceremony: 'The Aisle (paid in full)',
}

/** "Saturday, June 12, 2027" for the open-date note. */
function openDateLabel(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return 'Your date'
  return new Intl.DateTimeFormat('en-CA', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

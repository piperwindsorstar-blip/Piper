import {
  Link,
  createFileRoute,
  getRouteApi,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ChevronDown, Plus, X } from 'lucide-react'
import { useState } from 'react'
import {
  Chip,
  DeskTitle,
  deskCard,
  deskDanger,
  deskGhost,
  deskPrimary,
  invoiceTone,
  statusTone,
} from '../../components/desk-ui.tsx'
import { isPackageId } from '../../lib/crm/defaults.ts'
import type { PackageId } from '../../lib/crm/defaults.ts'
import { longDate } from '../../lib/crm/dates.ts'
import { todayInToronto } from '../../lib/crm/date-request.ts'
import {
  addBooking,
  changeStatus,
  getBookings,
  markSent,
  markVoid,
  recordPayment,
  saveBooking,
  sendBookingMail,
  sendInvoiceMail,
} from '../../lib/crm/desk.functions.ts'
import { invoiceControls } from '../../lib/crm/booking-rules.ts'
import { hasCoupleAddress } from '../../lib/crm/mail-copy.ts'
import { daysUntil } from '../../lib/desk-console.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { dollarsToCents, cad } from '../../lib/crm/money.ts'
import { PACKAGE_CENTS, quote } from '../../lib/piper/rules.ts'

const deskRoute = getRouteApi('/desk')

const FILTERS = [
  ['All', 'all'],
  ['Open', 'open'],
  ['Held', 'hold'],
  ['Booked', 'booked'],
  ['Cancelled', 'cancelled'],
] as const

export const Route = createFileRoute('/desk/bookings')({
  head: () => deskHead('Bookings · Piper DJing'),
  loader: () => getBookings(),
  component: BookingsPage,
})

function BookingsPage() {
  const bookings = Route.useLoaderData()
  const { payments, packages } = deskRoute.useLoaderData()
  const [filter, setFilter] = useState<(typeof FILTERS)[number][1]>('all')
  const [samples, setSamples] = useState(true)
  const pool = samples
    ? bookings
    : bookings.filter((booking) => !booking.sample)
  const list = pool.filter(
    (booking) => filter === 'all' || booking.status === filter,
  )

  return (
    <div className="grid gap-5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <DeskTitle kicker="Bookings" title="Bookings" />
        <label className="flex items-center gap-2 text-sm text-white/65">
          <input
            type="checkbox"
            checked={samples}
            onChange={(event) => setSamples(event.target.checked)}
          />
          Show test samples
        </label>
      </div>
      <NewBooking packages={packages} />
      <div
        role="tablist"
        aria-label="Status"
        className="no-scrollbar flex max-w-full gap-2 overflow-x-auto"
      >
        {FILTERS.map(([label, value]) => {
          const count =
            value === 'all'
              ? null
              : pool.filter((booking) => booking.status === value).length
          return (
            <button
              key={value}
              type="button"
              role="tab"
              aria-selected={filter === value}
              onClick={() => setFilter(value)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold ${
                filter === value
                  ? 'border-neon bg-neon text-white'
                  : 'border-white/15 text-white/65 hover:text-white'
              }`}
            >
              {label}
              {count === null ? '' : ` · ${count}`}
            </button>
          )
        })}
      </div>
      {bookings.length === 0 ? (
        <p className="text-sm text-white/65">No bookings yet.</p>
      ) : list.length === 0 ? (
        <p className="text-sm text-white/65">No bookings here.</p>
      ) : null}
      <div className="grid gap-3">
        {list.map((booking) => (
          <BookingCard
            key={booking.id}
            booking={booking}
            packages={packages}
            payments={payments.filter(
              (payment) => payment.bookingId === booking.id,
            )}
          />
        ))}
      </div>
    </div>
  )
}

function NewBooking({
  packages,
}: {
  packages: { id: string; name: string; cents: number }[]
}) {
  const add = useServerFn(addBooking)
  const router = useRouter()
  const prices = priceRecord(packages)
  const [error, setError] = useState<string | null>(null)
  const [packageId, setPackageId] = useState('full')
  const [open, setOpen] = useState(false)
  const [preview, setPreview] = useState(() =>
    quote(
      { packageId: 'full', withStag: false, uplights: 0, venueKm: [] },
      prices,
    ),
  )

  return (
    <section className={`${deskCard} ${open ? 'border-neon/40' : ''}`}>
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full items-center justify-between text-left"
      >
        <span className="flex items-center gap-3 font-display text-xl font-bold">
          <span className="grid h-9 w-9 place-items-center rounded-full bg-neon text-white">
            {open ? (
              <X className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Plus className="h-4 w-4" aria-hidden="true" />
            )}
          </span>
          New booking
        </span>
      </button>
      <form
        className={open ? 'mt-5 grid gap-4' : 'hidden'}
        onChange={(event) => {
          const next = liveQuote(event.currentTarget, prices)
          if (next) setPreview(next)
        }}
        onSubmit={(event) => {
          event.preventDefault()
          const formElement = event.currentTarget
          const form = new FormData(formElement)
          const withStag = form.get('withStag') === 'on'
          void add({
            data: {
              partnerOne: String(form.get('partnerOne') ?? ''),
              partnerTwo: String(form.get('partnerTwo') ?? ''),
              email: String(form.get('email') ?? ''),
              phone: String(form.get('phone') ?? ''),
              eventDate: String(form.get('eventDate') ?? ''),
              stagDate: withStag ? String(form.get('stagDate') ?? '') : null,
              packageId: String(form.get('packageId') ?? 'full'),
              withStag,
              uplights: Number(form.get('uplights') ?? 0),
              venueKm: kilometres(form),
              venueName: String(form.get('venueName') ?? ''),
              venueStreet: String(form.get('venueStreet') ?? ''),
              venueTwoName: String(form.get('venueTwoName') ?? ''),
              venueTwoStreet: String(form.get('venueTwoStreet') ?? ''),
              sample: form.get('sample') === 'on',
              notes: String(form.get('notes') ?? ''),
            },
          }).then(async (result) => {
            if (!result.ok) {
              setError(result.error)
              return
            }
            setError(null)
            setOpen(false)
            formElement.reset()
            setPackageId('full')
            setPreview(
              quote(
                {
                  packageId: 'full',
                  withStag: false,
                  uplights: 0,
                  venueKm: [],
                },
                prices,
              ),
            )
            await router.invalidate()
          })
        }}
      >
        <BookingFields
          packageId={packageId}
          onPackage={setPackageId}
          packages={packages}
        />
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/10 bg-ink-950 p-4">
          <div className="flex gap-8">
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/65">
                Total
              </p>
              <p className="font-display text-2xl font-extrabold tabular-nums">
                {cad(preview.totalCents)}
              </p>
            </div>
            <div>
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/65">
                Deposit
              </p>
              <p className="font-display text-2xl font-extrabold text-hot tabular-nums">
                {cad(preview.depositCents)}
              </p>
            </div>
          </div>
          <p className="max-w-xs text-xs text-white/65">
            Travel is added from kilometres once the venue is set. The first 20
            are included.
          </p>
          <button type="submit" className={deskPrimary}>
            Save as open
          </button>
        </div>
      </form>
    </section>
  )
}

function priceRecord(
  packages: { id: string; cents: number }[],
): Record<PackageId, number> {
  const prices: Record<PackageId, number> = { ...PACKAGE_CENTS }
  for (const item of packages) {
    if (isPackageId(item.id)) prices[item.id] = item.cents
  }
  return prices
}

function liveQuote(form: HTMLFormElement, prices: Record<PackageId, number>) {
  const data = new FormData(form)
  const packageId = String(data.get('packageId') ?? 'full')
  if (!isPackageId(packageId)) return null
  const uplights = Number(data.get('uplights') ?? 0)
  if (!Number.isInteger(uplights) || uplights < 0) return null
  const venueKm = kilometres(data).filter(
    (km) => Number.isFinite(km) && km >= 0,
  )
  try {
    return quote(
      {
        packageId,
        withStag: packageId === 'full' && data.get('withStag') === 'on',
        uplights,
        venueKm,
      },
      prices,
    )
  } catch {
    return null
  }
}

function BookingCard({
  booking,
  payments,
  packages,
}: {
  packages: { id: string; name: string }[]
  booking: {
    id: number
    slug: string
    partnerOne: string
    partnerTwo: string
    email: string
    phone: string
    eventDate: string
    stagDate: string | null
    packageId: string
    packageName: string
    withStag: boolean
    uplights: number
    venueKm: number[]
    venueName: string
    venueStreet: string
    venueTwoName: string
    venueTwoStreet: string
    sample: boolean
    status: string
    totalCents: number
    depositCents: number
    holdStartedOn: string | null
    holdLastDay: string | null
    stagReleased: boolean
    notes: string
    invoice: {
      id: number
      slug: string
      status: string
      totalCents: number
      depositCents: number
      receivedCents: number
      balanceCents: number
    } | null
  }
  payments: { id: number; cents: number; note: string }[]
}) {
  const save = useServerFn(saveBooking)
  const status = useServerFn(changeStatus)
  const sent = useServerFn(markSent)
  const voided = useServerFn(markVoid)
  const pay = useServerFn(recordPayment)
  const mailBooking = useServerFn(sendBookingMail)
  const mailInvoice = useServerFn(sendInvoiceMail)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [packageId, setPackageId] = useState(booking.packageId)
  const [open, setOpen] = useState(false)
  const [action, setAction] = useState('release')
  const formKey = `${booking.status}-${booking.invoice?.status}-${booking.invoice?.receivedCents}-${booking.holdLastDay}-${booking.notes}`
  const daysLeft =
    booking.status === 'hold' && booking.holdLastDay
      ? daysUntil(todayInToronto(), booking.holdLastDay)
      : null
  const controls = invoiceControls(booking.invoice?.status ?? null)
  const canMail = hasCoupleAddress(booking.email)

  return (
    <article
      className={`rounded-2xl border bg-ink-900 ${open ? 'border-neon/40' : 'border-white/10'}`}
    >
      <button
        type="button"
        aria-expanded={open}
        onClick={() => setOpen((value) => !value)}
        className="flex w-full flex-wrap items-center gap-x-4 gap-y-2 p-5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-display text-xl font-bold">
              {booking.partnerOne} and {booking.partnerTwo}
            </h2>
            {booking.sample ? (
              <span className="text-sm tracking-wide text-rose-300">TEST</span>
            ) : null}
          </div>
          <p className="text-sm text-white/65">
            {longDate(booking.eventDate)} · {booking.packageName}
            {booking.stagDate ? ` · stag ${longDate(booking.stagDate)}` : ''}
            {booking.stagReleased ? ' · stag released' : ''}
          </p>
          {booking.holdStartedOn && booking.holdLastDay ? (
            <p className="mt-1 text-sm text-white/65">
              Hold {longDate(booking.holdStartedOn)} through{' '}
              {longDate(booking.holdLastDay)}
            </p>
          ) : null}
          <p className="mt-1 text-sm text-white/85 tabular-nums">
            {cad(booking.invoice?.totalCents ?? booking.totalCents)} total ·{' '}
            {cad(booking.invoice?.depositCents ?? booking.depositCents)} deposit
            · {cad(booking.invoice?.receivedCents ?? 0)} received ·{' '}
            {cad(booking.invoice?.balanceCents ?? booking.totalCents)} balance
            {booking.invoice ? ` · invoice ${booking.invoice.status}` : ''}
          </p>
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-2">
            <Chip tone={statusTone(booking.status)}>{booking.status}</Chip>
            {booking.invoice ? (
              <Chip tone={invoiceTone(booking.invoice.status)}>
                invoice {booking.invoice.status}
              </Chip>
            ) : null}
          </div>
          {daysLeft !== null && booking.holdLastDay ? (
            <span
              className={`text-xs ${daysLeft < 10 ? 'text-amber-200' : 'text-white/65'}`}
            >
              Hold ends {longDate(booking.holdLastDay)} · {daysLeft} days left
            </span>
          ) : null}
        </div>
        <ChevronDown
          className={`desk-motion h-5 w-5 text-white/40 ${open ? 'rotate-180' : ''}`}
          aria-hidden="true"
        />
      </button>
      <div
        className={open ? 'space-y-5 border-t border-white/10 p-5' : 'hidden'}
      >
        <p className="flex flex-wrap gap-4 text-sm">
          <Link
            to="/c/$slug"
            params={{ slug: booking.slug }}
            className="font-semibold text-hot hover:underline"
          >
            Couple page
          </Link>
          <span className="text-white/65">
            Their planning form is on that page.
          </span>
          {booking.invoice ? (
            <Link
              to="/p/$slug"
              params={{ slug: booking.invoice.slug }}
              className="font-semibold text-hot hover:underline"
            >
              Invoice page
            </Link>
          ) : null}
        </p>
        <form
          key={formKey}
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const form = new FormData(event.currentTarget)
            const withStag = form.get('withStag') === 'on'
            void save({
              data: {
                id: booking.id,
                partnerOne: String(form.get('partnerOne') ?? ''),
                partnerTwo: String(form.get('partnerTwo') ?? ''),
                email: String(form.get('email') ?? ''),
                phone: String(form.get('phone') ?? ''),
                eventDate: String(form.get('eventDate') ?? ''),
                stagDate: withStag ? String(form.get('stagDate') ?? '') : null,
                packageId: String(form.get('packageId') ?? booking.packageId),
                withStag,
                uplights: Number(form.get('uplights') ?? 0),
                venueKm: kilometres(form),
                venueName: String(form.get('venueName') ?? ''),
                venueStreet: String(form.get('venueStreet') ?? ''),
                venueTwoName: String(form.get('venueTwoName') ?? ''),
                venueTwoStreet: String(form.get('venueTwoStreet') ?? ''),
                sample: form.get('sample') === 'on',
                notes: String(form.get('notes') ?? ''),
              },
            }).then(async (result) => {
              if (!result.ok) {
                setError(result.error)
                return
              }
              setError(null)
              setNotice('Saved.')
              await router.invalidate()
            })
          }}
        >
          <BookingFields
            packageId={packageId}
            onPackage={setPackageId}
            packages={packages}
            columns={3}
            defaults={{
              partnerOne: booking.partnerOne,
              partnerTwo: booking.partnerTwo,
              email: booking.email,
              phone: booking.phone,
              eventDate: booking.eventDate,
              stagDate: booking.stagDate ?? '',
              withStag: booking.withStag,
              uplights: booking.uplights,
              kmOne: booking.venueKm[0] ?? '',
              kmTwo: booking.venueKm[1] ?? '',
              venueName: booking.venueName,
              venueStreet: booking.venueStreet,
              venueTwoName: booking.venueTwoName,
              venueTwoStreet: booking.venueTwoStreet,
              sample: booking.sample,
              notes: booking.notes,
            }}
          />
          {!booking.venueName.trim() || !booking.venueStreet.trim() ? (
            <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100 md:col-span-3">
              Add the venue name and street. The hold starts when the invoice is
              sent and both are filled in.
            </p>
          ) : null}
          <button type="submit" className={`${deskGhost} w-fit`}>
            Save details
          </button>
        </form>
        <div className="flex flex-wrap gap-2">
          {controls.send ? (
            <button
              type="button"
              className={deskPrimary}
              onClick={() => {
                void sent({ data: { id: booking.id } })
                  .then(async (result) => {
                    if (!result.ok) {
                      setError(result.error)
                      return
                    }
                    setError(null)
                    setNotice(
                      result.newlyBooked
                        ? 'The deposit cleared. The date is booked.'
                        : 'The invoice is sent.',
                    )
                    await router.invalidate()
                  })
                  .catch((caught: unknown) => {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : 'That did not save.',
                    )
                  })
              }}
            >
              Mark the invoice sent
            </button>
          ) : null}
          {controls.canVoid ? (
            <button
              type="button"
              className={deskDanger}
              onClick={() => {
                void voided({ data: { id: booking.id } })
                  .then(async (result) => {
                    if (!result.ok) {
                      setError(result.error)
                      return
                    }
                    setError(null)
                    setNotice('The invoice is void. The balance is zero.')
                    await router.invalidate()
                  })
                  .catch((caught: unknown) => {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : 'That did not save.',
                    )
                  })
              }}
            >
              Void the invoice
            </button>
          ) : null}
          {canMail ? (
            <button
              type="button"
              className={deskGhost}
              onClick={() => {
                void mailBooking({ data: { id: booking.id } })
                  .then(async (result) => {
                    if (!result.ok) {
                      setError(result.error)
                      return
                    }
                    setError(null)
                    setNotice(
                      result.delivered
                        ? `The booking email is on its way to ${booking.email}.`
                        : result.detail,
                    )
                    await router.invalidate()
                  })
                  .catch((caught: unknown) => {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : 'That did not save.',
                    )
                  })
              }}
            >
              Email the booking
            </button>
          ) : null}
          {booking.invoice && canMail ? (
            <button
              type="button"
              className={deskGhost}
              onClick={() => {
                void mailInvoice({ data: { id: booking.id } })
                  .then(async (result) => {
                    if (!result.ok) {
                      setError(result.error)
                      return
                    }
                    setError(null)
                    setNotice(
                      result.delivered
                        ? `The invoice email is on its way to ${booking.email}.`
                        : result.detail,
                    )
                    await router.invalidate()
                  })
                  .catch((caught: unknown) => {
                    setError(
                      caught instanceof Error
                        ? caught.message
                        : 'That did not save.',
                    )
                  })
              }}
            >
              Email the invoice
            </button>
          ) : null}
        </div>
        {controls.blocked ? (
          <p className="text-sm text-white/85">{controls.blocked}</p>
        ) : null}
        {!canMail ? (
          <p className="text-sm text-rose-300">
            This booking has no email address.
          </p>
        ) : null}
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
        <div className="grid gap-5 md:grid-cols-2">
          <form
            className="rounded-xl border border-white/10 bg-ink-950 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              const form = new FormData(event.currentTarget)
              const next = String(form.get('action') ?? '')
              if (
                next !== 'release' &&
                next !== 'cancel' &&
                next !== 'release-stag'
              )
                return
              void status({ data: { id: booking.id, action: next } }).then(
                async (result) => {
                  if (!result.ok) {
                    setError(result.error)
                    return
                  }
                  setError(null)
                  setNotice('The status is updated.')
                  await router.invalidate()
                },
              )
            }}
          >
            <label className="field min-w-52">
              Status
              <select
                name="action"
                value={action}
                onChange={(event) => setAction(event.target.value)}
              >
                <option value="release">Release the date</option>
                <option value="cancel">Cancel</option>
                {booking.withStag && !booking.stagReleased ? (
                  <option value="release-stag">Release the stag date</option>
                ) : null}
              </select>
            </label>
            <button
              type="submit"
              className={`mt-3 ${action === 'cancel' ? deskDanger : deskGhost}`}
            >
              Update status
            </button>
          </form>
          <form
            className="rounded-xl border border-white/10 bg-ink-950 p-4"
            onSubmit={(event) => {
              event.preventDefault()
              const submitter =
                event.nativeEvent instanceof SubmitEvent
                  ? event.nativeEvent.submitter
                  : null
              const form = new FormData(event.currentTarget, submitter)
              const refund = form.get('kind') === 'refund'
              try {
                const cents = dollarsToCents(String(form.get('amount') ?? ''))
                void pay({
                  data: {
                    id: booking.id,
                    cents: refund ? -cents : cents,
                    note: String(form.get('note') ?? ''),
                  },
                }).then(async (result) => {
                  if (!result.ok) {
                    setError(result.error)
                    return
                  }
                  setError(null)
                  setNotice(
                    result.newlyBooked
                      ? 'The deposit cleared. The date is booked.'
                      : refund
                        ? 'The refund is on the invoice. The date stays booked.'
                        : 'The payment is on the invoice.',
                  )
                  await router.invalidate()
                })
              } catch (caught) {
                setError(
                  caught instanceof Error ? caught.message : 'Enter an amount.',
                )
              }
            }}
          >
            <p className="font-semibold">Record payment</p>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="field w-36">
                Amount
                <input name="amount" inputMode="decimal" placeholder="500.00" />
              </label>
              <label className="field min-w-40 flex-1">
                Note
                <input name="note" />
              </label>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <button name="kind" value="payment" className={deskPrimary}>
                Record payment
              </button>
              <button name="kind" value="refund" className={deskGhost}>
                Record refund
              </button>
            </div>
            {payments.length > 0 ? (
              <ul className="mt-3 space-y-1 text-sm">
                {payments.map((payment) => (
                  <li
                    key={payment.id}
                    className="flex justify-between gap-3 text-white/65"
                  >
                    <span>{payment.note}</span>
                    <span
                      className={`tabular-nums ${payment.cents < 0 ? 'text-rose-300' : ''}`}
                    >
                      {cad(payment.cents)}
                    </span>
                  </li>
                ))}
              </ul>
            ) : null}
          </form>
        </div>
      </div>
    </article>
  )
}

function kilometres(form: FormData): number[] {
  return ['kmOne', 'kmTwo']
    .map((name) => String(form.get(name) ?? '').trim())
    .filter((value) => value !== '')
    .map((value) => Number(value))
}

function BookingFields({
  packageId,
  onPackage,
  packages,
  defaults,
  columns = 2,
}: {
  packageId: string
  onPackage: (value: string) => void
  packages: { id: string; name: string }[]
  columns?: 2 | 3
  defaults?: {
    partnerOne: string
    partnerTwo: string
    email: string
    phone: string
    eventDate: string
    stagDate: string
    withStag: boolean
    uplights: number
    kmOne: number | ''
    kmTwo: number | ''
    venueName: string
    venueStreet: string
    venueTwoName: string
    venueTwoStreet: string
    sample: boolean
    notes: string
  }
}) {
  const span = columns === 3 ? 'md:col-span-3' : 'md:col-span-2'
  return (
    <div
      className={`grid gap-3 ${columns === 3 ? 'md:grid-cols-3' : 'md:grid-cols-2'}`}
    >
      <label className="field">
        First partner
        <input name="partnerOne" required defaultValue={defaults?.partnerOne} />
      </label>
      <label className="field">
        Second partner
        <input name="partnerTwo" required defaultValue={defaults?.partnerTwo} />
      </label>
      <label className="field">
        Email
        <input name="email" defaultValue={defaults?.email} />
      </label>
      <label className="field">
        Phone
        <input name="phone" defaultValue={defaults?.phone} />
      </label>
      <label className="field">
        Wedding date
        <input
          name="eventDate"
          type="date"
          required
          defaultValue={defaults?.eventDate}
        />
      </label>
      <label className="field">
        Package
        <select
          name="packageId"
          value={packageId}
          onChange={(event) => onPackage(event.target.value)}
        >
          {packages.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {packageId === 'full' ? (
        <label
          className={`flex items-center gap-3 text-sm text-white/85 ${span}`}
        >
          <input
            name="withStag"
            type="checkbox"
            defaultChecked={defaults?.withStag}
          />
          Full day plus a stag, one booking
        </label>
      ) : null}
      {packageId === 'full' ? (
        <label className="field">
          Stag date
          <input
            name="stagDate"
            type="date"
            defaultValue={defaults?.stagDate}
          />
        </label>
      ) : null}
      <label className="field">
        Uplights
        <input
          name="uplights"
          type="number"
          min={0}
          defaultValue={defaults?.uplights ?? 0}
        />
      </label>
      <label className="field">
        Kilometres to the venue
        <input
          name="kmOne"
          inputMode="decimal"
          defaultValue={defaults?.kmOne}
        />
      </label>
      <label className="field">
        Kilometres to the second venue
        <input
          name="kmTwo"
          inputMode="decimal"
          defaultValue={defaults?.kmTwo}
        />
      </label>
      <label className="field">
        Venue name
        <input name="venueName" defaultValue={defaults?.venueName} />
      </label>
      <label className="field">
        Venue street
        <input name="venueStreet" defaultValue={defaults?.venueStreet} />
      </label>
      <label className="field">
        Second venue name
        <input name="venueTwoName" defaultValue={defaults?.venueTwoName} />
      </label>
      <label className="field">
        Second venue street
        <input name="venueTwoStreet" defaultValue={defaults?.venueTwoStreet} />
      </label>
      <label className={`field ${span}`}>
        Notes
        <textarea name="notes" rows={3} defaultValue={defaults?.notes} />
      </label>
      <label
        className={`flex items-center gap-3 text-sm text-white/85 ${span}`}
      >
        <input
          name="sample"
          type="checkbox"
          defaultChecked={defaults?.sample}
        />
        TEST sample. Off the public date check, off the calendar, and out of
        totals.
      </label>
    </div>
  )
}

import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { PACKAGE_BUTTON_COPY } from '../../lib/crm/defaults.ts'
import { longDate } from '../../lib/crm/dates.ts'
import {
  addBooking,
  changeStatus,
  getBookings,
  markSent,
  markVoid,
  recordPayment,
  saveBooking,
} from '../../lib/crm/desk.functions.ts'
import { dollarsToCents, cad } from '../../lib/crm/money.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/bookings')({
  head: () => privateHead('Bookings · Piper DJing'),
  loader: () => getBookings(),
  component: BookingsPage,
})

function BookingsPage() {
  const bookings = Route.useLoaderData()
  return (
    <div className="grid gap-8">
      <h1 className="font-display text-4xl tracking-tight">Bookings</h1>
      <NewBooking />
      {bookings.length === 0 ? <p className="text-ink-soft">The local book is empty.</p> : null}
      <div className="grid gap-6">
        {bookings.map((booking) => (
          <BookingCard key={`${booking.id}-${booking.status}-${booking.invoice?.receivedCents}`} booking={booking} />
        ))}
      </div>
    </div>
  )
}

function NewBooking() {
  const add = useServerFn(addBooking)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [packageId, setPackageId] = useState('full')

  return (
    <details className="rounded-card border border-line bg-ivory px-5 py-4">
      <summary className="cursor-pointer font-display text-2xl">New booking</summary>
      <form
        className="mt-4 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
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
            await router.invalidate()
          })
        }}
      >
        <BookingFields packageId={packageId} onPackage={setPackageId} />
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className="min-h-11 rounded-full bg-ink px-4 text-sm text-ivory">
          Save as open
        </button>
      </form>
    </details>
  )
}

function BookingCard({
  booking,
}: {
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
}) {
  const save = useServerFn(saveBooking)
  const status = useServerFn(changeStatus)
  const sent = useServerFn(markSent)
  const voided = useServerFn(markVoid)
  const pay = useServerFn(recordPayment)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [packageId, setPackageId] = useState(booking.packageId)

  return (
    <article className="rounded-card border border-line bg-ivory px-5 py-6">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2 className="font-display text-2xl">
          {booking.partnerOne} and {booking.partnerTwo}
          {booking.sample ? <span className="ml-3 text-sm tracking-wide text-danger">TEST</span> : null}
        </h2>
        <p className="text-sm uppercase tracking-wide text-muted">{booking.status}</p>
      </div>
      <p className="mt-2 text-sm text-muted">
        {longDate(booking.eventDate)}
        {booking.stagDate ? ` · stag ${longDate(booking.stagDate)}` : ''}
        {booking.stagReleased ? ' · stag released' : ''}
      </p>
      {booking.holdStartedOn && booking.holdLastDay ? (
        <p className="mt-1 text-sm text-muted">
          Hold {longDate(booking.holdStartedOn)} through {longDate(booking.holdLastDay)}
        </p>
      ) : null}
      <p className="mt-3 text-sm">
        {cad(booking.invoice?.totalCents ?? booking.totalCents)} total · {cad(booking.invoice?.depositCents ?? booking.depositCents)}{' '}
        deposit · {cad(booking.invoice?.receivedCents ?? 0)} received · {cad(booking.invoice?.balanceCents ?? booking.totalCents)}{' '}
        balance
        {booking.invoice ? ` · invoice ${booking.invoice.status}` : ''}
      </p>
      <p className="mt-3 flex flex-wrap gap-4 text-sm">
        <Link to="/c/$slug" params={{ slug: booking.slug }} className="text-ink">
          Couple page
        </Link>
        {booking.invoice ? (
          <Link to="/p/$slug" params={{ slug: booking.invoice.slug }} className="text-ink">
            Invoice page
          </Link>
        ) : null}
      </p>
      <form
        className="mt-5 grid gap-3"
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
        <button type="submit" className="min-h-11 rounded-full border border-ink px-4 text-sm">
          Save details
        </button>
      </form>
      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          className="min-h-11 rounded-full bg-ink px-4 text-sm text-ivory"
          onClick={() => {
            void sent({ data: { id: booking.id } }).then(async (result) => {
              if (!result.ok) {
                setError(result.error)
                return
              }
              setError(null)
              setNotice(result.newlyBooked ? 'The deposit cleared. The date is booked.' : 'The invoice is sent.')
              await router.invalidate()
            })
          }}
        >
          Mark the invoice sent
        </button>
        <button
          type="button"
          className="min-h-11 rounded-full border border-line px-4 text-sm"
          onClick={() => {
            void voided({ data: { id: booking.id } }).then(async (result) => {
              if (!result.ok) {
                setError(result.error)
                return
              }
              setNotice('The invoice is void. The balance is zero.')
              await router.invalidate()
            })
          }}
        >
          Void the invoice
        </button>
      </div>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const action = String(form.get('action') ?? '')
          if (action !== 'release' && action !== 'cancel' && action !== 'release-stag') return
          void status({ data: { id: booking.id, action } }).then(async (result) => {
            if (!result.ok) {
              setError(result.error)
              return
            }
            setError(null)
            setNotice('The status is updated.')
            await router.invalidate()
          })
        }}
      >
        <label className="field min-w-52">
          Status
          <select name="action" defaultValue="release">
            <option value="release">Release the date</option>
            <option value="cancel">Cancel</option>
            {booking.withStag && !booking.stagReleased ? (
              <option value="release-stag">Release the stag date</option>
            ) : null}
          </select>
        </label>
        <button type="submit" className="min-h-11 rounded-full border border-ink px-4 text-sm">
          Update status
        </button>
      </form>
      <form
        className="mt-4 flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          const refund = form.get('kind') === 'refund'
          try {
            const cents = dollarsToCents(String(form.get('amount') ?? ''))
            void pay({
              data: { id: booking.id, cents: refund ? -cents : cents, note: String(form.get('note') ?? '') },
            }).then(async (result) => {
              if (!result.ok) {
                setError(result.error)
                return
              }
              setError(null)
              setNotice(result.newlyBooked ? 'The deposit cleared. The date is booked.' : 'The payment is on the invoice.')
              await router.invalidate()
            })
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : 'Enter an amount.')
          }
        }}
      >
        <label className="field w-36">
          Amount
          <input name="amount" inputMode="decimal" placeholder="500.00" />
        </label>
        <label className="field min-w-40 flex-1">
          Note
          <input name="note" />
        </label>
        <button name="kind" value="payment" className="min-h-11 rounded-full bg-ink px-4 text-sm text-ivory">
          Record payment
        </button>
        <button name="kind" value="refund" className="min-h-11 rounded-full border border-ink px-4 text-sm">
          Record refund
        </button>
      </form>
      {error ? <p className="mt-3 text-sm text-danger">{error}</p> : null}
      {notice ? <p className="mt-3 text-sm text-ink-soft">{notice}</p> : null}
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
  defaults,
}: {
  packageId: string
  onPackage: (value: string) => void
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
  return (
    <div className="grid gap-3 sm:grid-cols-2">
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
        <input name="eventDate" type="date" required defaultValue={defaults?.eventDate} />
      </label>
      <label className="field">
        Package
        <select
          name="packageId"
          value={packageId}
          onChange={(event) => onPackage(event.target.value)}
        >
          {PACKAGE_BUTTON_COPY.map((item) => (
            <option key={item.id} value={item.id}>
              {item.name}
            </option>
          ))}
        </select>
      </label>
      {packageId === 'full' ? (
        <label className="flex items-center gap-3 text-sm sm:col-span-2">
          <input name="withStag" type="checkbox" defaultChecked={defaults?.withStag} />
          Full day plus a stag, one booking
        </label>
      ) : null}
      {packageId === 'full' ? (
        <label className="field">
          Stag date
          <input name="stagDate" type="date" defaultValue={defaults?.stagDate} />
        </label>
      ) : null}
      <label className="field">
        Uplights
        <input name="uplights" type="number" min={0} defaultValue={defaults?.uplights ?? 0} />
      </label>
      <label className="field">
        Kilometres to the venue
        <input name="kmOne" inputMode="decimal" defaultValue={defaults?.kmOne} />
      </label>
      <label className="field">
        Kilometres to the second venue
        <input name="kmTwo" inputMode="decimal" defaultValue={defaults?.kmTwo} />
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
      <label className="field sm:col-span-2">
        Notes
        <textarea name="notes" rows={3} defaultValue={defaults?.notes} />
      </label>
      <label className="flex items-center gap-3 text-sm sm:col-span-2">
        <input name="sample" type="checkbox" defaultChecked={defaults?.sample} />
        TEST sample. Off the public date check, off the calendar, and out of totals.
      </label>
    </div>
  )
}

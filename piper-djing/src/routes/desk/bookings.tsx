import {
  Link,
  createFileRoute,
  getRouteApi,
  useRouter,
} from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  List,
  Mail,
  Phone,
  Plus,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { PortalDeskFields } from '../../components/portal/desk-fields.tsx'
import {
  Bar,
  Chip,
  CoupleName,
  DateBlock,
  DeskTitle,
  deskCard,
  deskDark,
  deskH2,
  deskKicker,
  deskDanger,
  deskGhost,
  deskPrimary,
  MoneyBar,
  invoiceTone,
  statusTone,
  deskSurface,
} from '../../components/desk-ui.tsx'
import { isPackageId } from '../../lib/crm/defaults.ts'
import {
  externalCouple,
  externalKindLabel,
  externalVenues,
} from '../../lib/crm/external-dates.ts'
import type { ExternalDate } from '../../lib/crm/external-dates.ts'
import { matchingVenue } from '../../lib/crm/venues.ts'
import type { SavedVenue } from '../../lib/crm/venues.ts'
import type { PackageId } from '../../lib/crm/defaults.ts'
import { longDate } from '../../lib/crm/dates.ts'
import { todayInToronto } from '../../lib/crm/date-request.ts'
import {
  addBooking,
  addExternalDate,
  addVenue,
  changeStatus,
  editVenue,
  deleteBooking,
  deleteExternal,
  deleteVenue,
  getBookings,
  checkDistance,
  recalcTravel,
  releaseExternal,
  saveTravel,
  markSent,
  markVoid,
  recordPayment,
  saveBooking,
  sendBookingMail,
  sendInvoiceMail,
  saveNotes,
} from '../../lib/crm/desk.functions.ts'
import { invoiceControls } from '../../lib/crm/booking-rules.ts'
import { hasCoupleAddress } from '../../lib/crm/mail-copy.ts'
import { daysUntil } from '../../lib/desk-console.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { dollarsToCents, cad } from '../../lib/crm/money.ts'
import { DESK_TRAVEL_COPY } from '../../lib/crm/travel-copy.ts'
import { TRAVEL_FAILED_TEXT, distanceLabel } from '../../lib/crm/travel.ts'
import type { TravelSource } from '../../lib/crm/travel.ts'
import {
  applyDiscount,
  deposit30,
  PACKAGE_CENTS,
  quote,
} from '../../lib/piper/rules.ts'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'

const deskRoute = getRouteApi('/desk')

type BookingsSearch = {
  couple?: number
  /** Start a new booking filled in from this inquiry. */
  lead?: number
  view?: 'list' | 'calendar'
  month?: string
  add?: boolean
  find?: boolean
}

export const Route = createFileRoute('/desk/bookings')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Bookings · DJ Piper P'),
  validateSearch: (search: Record<string, unknown>): BookingsSearch => {
    const out: BookingsSearch = {}
    const couple = Number(search.couple)
    if (Number.isInteger(couple) && couple > 0) out.couple = couple
    const lead = Number(search.lead)
    if (Number.isInteger(lead) && lead > 0) out.lead = lead
    if (search.view === 'calendar' || search.view === 'list') out.view = search.view
    if (typeof search.month === 'string' && /^\d{4}-\d{2}$/.test(search.month)) out.month = search.month
    if (search.add === true || search.add === 'true') out.add = true
    if (search.find === true || search.find === 'true') out.find = true
    return out
  },
  loader: () => getBookings(),
  component: BookingsRoute,
})

type BookingRow = Awaited<ReturnType<typeof getBookings>>[number]

type Filter = 'all' | 'yours' | 'pynx' | 'owes' | 'pending' | 'cancelled' | 'archive'

type ListRow = {
  key: string
  date: string
  couple: string
  detail: string
  venue: string
  mine: boolean
  bookingId?: number
  status: string
  sample: boolean
  paidCents: number
  totalCents: number
  owes: boolean
}

function dollars(cents: number): string {
  return cad(cents).replace(/\.00$/, '')
}

function monthLabel(key: string): string {
  return new Date(`${key}-15T12:00:00Z`).toLocaleDateString('en-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function statusLabel(status: string): string {
  if (status === 'hold') return 'Held'
  if (status === 'open') return 'Open'
  return status.charAt(0).toUpperCase() + status.slice(1)
}

function BookingsRoute() {
  const search = Route.useSearch()
  const bookings = Route.useLoaderData()
  const couple = search.couple ? bookings.find((booking) => booking.id === search.couple) : undefined
  if (search.couple && couple) return <CouplePage key={couple.id} booking={couple} />
  return <BookingsPage notFound={Boolean(search.couple)} />
}

function BookingsPage({ notFound }: { notFound: boolean }) {
  const search = Route.useSearch()
  const navigate = Route.useNavigate()
  const bookings = Route.useLoaderData()
  const { packages, externalDates, venues, leads } = deskRoute.useLoaderData()
  const today = todayInToronto()
  const fromLead = search.lead ? leads.find((lead) => lead.id === search.lead) : undefined
  const [filter, setFilter] = useState<Filter>('all')
  const [samples, setSamples] = useState(false)
  const [needle, setNeedle] = useState('')
  const [adding, setAdding] = useState(Boolean(search.add || fromLead))
  const view = search.view ?? 'list'
  const q = needle.trim().toLowerCase()

  const rows: ListRow[] = [
    ...bookings
      .filter((booking) => samples || !booking.sample)
      .map((booking) => {
        const total = booking.invoice?.totalCents ?? booking.totalCents
        const paid = Math.max(0, booking.invoice?.receivedCents ?? 0)
        const onBook = booking.status === 'hold' || booking.status === 'booked'
        return {
          key: `b-${booking.id}`,
          date: booking.eventDate,
          couple: `${booking.partnerOne} & ${booking.partnerTwo}`,
          detail: booking.packageName,
          venue: booking.venueName,
          mine: true,
          bookingId: booking.id,
          status: booking.status,
          sample: booking.sample,
          paidCents: paid,
          totalCents: total,
          owes: onBook && (booking.invoice?.balanceCents ?? total) > 0,
        }
      }),
    ...externalDates.map((row) => ({
      key: `x-${row.id}`,
      date: row.eventDate,
      couple: (externalCouple(row) || row.company).replace(' and ', ' & '),
      detail: externalKindLabel(row.kind),
      venue: row.venueName || (externalVenues(row)[0] ?? '').split(',')[0] || '',
      mine: false,
      status: row.released ? 'released' : 'booked',
      sample: false,
      paidCents: 0,
      totalCents: 0,
      owes: false,
    })),
  ].sort((a, b) => a.date.localeCompare(b.date))

  const gone = (row: ListRow) => row.status === 'cancelled' || row.status === 'released'
  // Weddings whose date has passed move to the Archive and off the other tabs.
  const test = (id: Filter, row: ListRow) => {
    if (id === 'cancelled') return gone(row)
    if (gone(row)) return false
    if (id === 'archive') return row.date < today
    if (row.date < today) return false
    if (id === 'yours') return row.mine
    if (id === 'pynx') return !row.mine
    if (id === 'owes') return row.owes
    if (id === 'pending') return row.mine && (row.status === 'open' || row.status === 'hold')
    return true
  }
  const shown = rows.filter(
    (row) => test(filter, row) && (!q || `${row.couple} ${row.venue} ${row.detail} ${row.date}`.toLowerCase().includes(q)),
  )
  const upcoming = filter === 'archive' ? [] : shown.filter((row) => row.date >= today)
  const past = filter === 'archive' || filter === 'cancelled' ? shown.filter((row) => row.date < today) : []
  // A search on another tab also says how many archived weddings match.
  const archivedMatches =
    q && filter !== 'archive'
      ? rows.filter((row) => test('archive', row) && `${row.couple} ${row.venue} ${row.detail} ${row.date}`.toLowerCase().includes(q)).length
      : 0
  const live = rows.filter((row) => !gone(row) && row.date >= today)
  // The same rules as the tabs, so the header and the tab counts agree.
  const yours = live.filter((row) => test('yours', row)).length
  const theirs = live.filter((row) => test('pynx', row)).length
  const notBooked = live.filter((row) => test('pending', row)).length
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`

  const filters: [Filter, string][] = [
    ['all', 'All'],
    ['yours', 'Yours'],
    ['pynx', 'Pynx'],
    ['owes', 'Owes money'],
    ['pending', 'Not booked yet'],
    ['cancelled', 'Cancelled'],
    ['archive', 'Archive'],
  ]

  return (
    <div className="grid gap-5">
      {notFound ? (
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800" role="status">
          That booking is not on the book any more.
        </p>
      ) : null}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <DeskTitle kicker="Your book" title="Bookings">
          {`${plural(live.length, 'wedding', 'weddings')} ahead: ${yours} yours, ${theirs} for Pynx.${notBooked > 0 ? ` ${notBooked} of yours ${notBooked === 1 ? 'is' : 'are'} not booked yet.` : ''}`}
        </DeskTitle>
        <button
          type="button"
          className={deskPrimary}
          aria-expanded={adding}
          onClick={() => setAdding((value) => !value)}
        >
          {adding ? <X className="h-4.5 w-4.5" aria-hidden="true" /> : <Plus className="h-4.5 w-4.5" aria-hidden="true" />}
          {adding ? 'Close' : 'New booking'}
        </button>
      </div>

      {adding ? (
        <NewBooking
          packages={packages}
          venues={venues}
          startOpen
          prefill={
            fromLead
              ? {
                  partnerOne: fromLead.partnerOne,
                  partnerTwo: fromLead.partnerTwo,
                  email: fromLead.email,
                  phone: fromLead.phone,
                  eventDate: fromLead.eventDate ?? '',
                  stagDate: fromLead.stagDate ?? '',
                  withStag: fromLead.withStag,
                  packageId: fromLead.packageId,
                }
              : undefined
          }
        />
      ) : null}

      <div className="grid min-w-0 gap-2.5 rounded-[18px] border border-[#e6def4] bg-white p-2.5 lg:flex lg:items-center lg:justify-between">
        <div className="grid min-w-0 gap-2 sm:flex sm:flex-1 sm:items-center">
          <input
            type="search"
            value={needle}
            autoFocus={Boolean(search.find)}
            onChange={(event) => setNeedle(event.target.value)}
            placeholder="Search a name or venue"
            aria-label="Search bookings"
            className="!min-h-11 w-full sm:w-60"
          />
          <div role="tablist" aria-label="Show" className="no-scrollbar flex min-w-0 gap-1.5 overflow-x-auto">
            {filters.map(([id, label]) => {
              const count = rows.filter((row) => test(id, row)).length
              if ((id === 'pending' || id === 'cancelled' || id === 'archive') && count === 0 && filter !== id) return null
              return (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={filter === id}
                  onClick={() => setFilter(id)}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-3.5 text-sm font-semibold ${
                    filter === id
                      ? 'bg-[#1c1533] !text-white'
                      : 'border border-[#d6cce8] bg-white text-[#1c1533] hover:border-[#ff007f]'
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-1.5 text-xs font-bold ${
                      filter === id ? 'bg-[#ff007f] text-[#1c1533]' : 'bg-[#efe9fb] text-[#4b3f72]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              )
            })}
          </div>
        </div>
        <div role="group" aria-label="View" className="flex w-fit shrink-0 rounded-xl bg-[#efe9fb] p-1">
          {(
            [
              ['list', 'List', List],
              ['calendar', 'Calendar', Calendar],
            ] as const
          ).map(([id, label, Icon]) => (
            <button
              key={id}
              type="button"
              aria-pressed={view === id}
              onClick={() => void navigate({ search: (prev) => ({ ...prev, view: id }) })}
              className={`inline-flex min-h-10 items-center gap-2 rounded-lg px-3.5 text-sm ${
                view === id
                  ? 'bg-white font-bold text-[#1c1533] shadow-[0_1px_2px_rgba(28,21,51,0.14)]'
                  : 'font-semibold text-[#4b3f72]'
              }`}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              {label}
            </button>
          ))}
        </div>
      </div>

      {view === 'calendar' ? (
        <MonthCalendar
          // The calendar still shows past months, so it ignores the Archive split.
          rows={rows.filter(
            (row) =>
              (filter === 'archive' ? test('archive', row) : test(filter, row.date < today ? { ...row, date: today } : row)) &&
              (!q || `${row.couple} ${row.venue} ${row.detail} ${row.date}`.toLowerCase().includes(q)),
          )}
          today={today}
          start={search.month}
        />
      ) : (
        <div className="grid gap-5">
          {upcoming.length === 0 && past.length === 0 ? (
            <p className={`${deskCard} text-[#5b5370]`}>
              {q ? 'No booking matches that search.' : filter === 'archive' ? 'No past weddings yet.' : 'Nothing here yet.'}
            </p>
          ) : null}
          {groupByMonth(upcoming).map(([key, group]) => (
            <MonthGroup key={key} label={monthLabel(key)} rows={group} today={today} />
          ))}
          {past.length > 0 ? (
            <div className="grid gap-5">
              {filter === 'archive' ? null : (
                <h2 className="px-1 font-display text-lg font-extrabold">Past</h2>
              )}
              {groupByMonth([...past].reverse()).map(([key, group]) => (
                <MonthGroup key={key} label={monthLabel(key)} rows={group} today={today} />
              ))}
            </div>
          ) : null}
          {archivedMatches > 0 ? (
            <button
              type="button"
              onClick={() => setFilter('archive')}
              className="min-h-11 w-fit px-1 text-sm font-semibold text-[#d1006b] hover:underline"
            >
              {`${archivedMatches} past ${archivedMatches === 1 ? 'wedding matches' : 'weddings match'} in the Archive`}
            </button>
          ) : null}
        </div>
      )}

      <label className="flex min-h-11 w-fit items-center gap-2 text-sm text-[#5b5370]">
        <input type="checkbox" checked={samples} onChange={(event) => setSamples(event.target.checked)} />
        Show test samples
      </label>

      <section aria-labelledby="booking-tools" className="grid gap-3 pt-2">
        <h2 id="booking-tools" className="font-display text-xl font-extrabold">
          Other dates and venues
        </h2>
        <DistanceCheck />
        <ExternalDates dates={externalDates} venues={venues} />
        <SavedVenues venues={venues} />
      </section>
    </div>
  )
}

function groupByMonth(rows: ListRow[]): [string, ListRow[]][] {
  const groups = new Map<string, ListRow[]>()
  for (const row of rows) {
    const key = row.date.slice(0, 7)
    groups.set(key, [...(groups.get(key) ?? []), row])
  }
  return [...groups.entries()]
}

function MonthGroup({ label, rows, today }: { label: string; rows: ListRow[]; today: string }) {
  return (
    <section className="grid gap-2">
      <h2 className="flex items-baseline gap-2.5 px-1 font-display text-xl font-extrabold tracking-tight">
        {label}
        <span className="font-sans text-sm font-medium text-[#5b5370]">
          {`${rows.length ?? ''} ${rows.length === 1 ? 'wedding' : 'weddings'}`}
        </span>
      </h2>
      <ul className="overflow-hidden rounded-[18px] border border-[#e6def4] bg-white">
        {rows.map((row) => (
          <li key={row.key} className="border-t border-[#f0ebf8] first:border-t-0">
            <BookingLine row={row} today={today} />
          </li>
        ))}
      </ul>
    </section>
  )
}

function BookingLine({ row, today }: { row: ListRow; today: string }) {
  const days = daysUntil(today, row.date)
  const when = days < 0 ? longDate(row.date) : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`
  const inner = (
    <>
      <DateBlock date={row.date} mine={row.mine} />
      <span className="grid min-w-0 gap-0.5">
        <span className="flex flex-wrap items-center gap-2 font-semibold">
          {row.couple}
          {row.sample ? <Chip tone="red">Test</Chip> : null}
        </span>
        <span className="truncate text-sm text-[#5b5370]">
          {`${when ?? ''} · ${row.detail ?? ''}`}
          <span className="md:hidden">{row.venue ? ` · ${row.venue}` : ''}</span>
        </span>
        {row.mine && row.totalCents > 0 ? (
          <span className="flex items-center gap-2 md:hidden">
            <span className="flex-1">
              <Bar value={(row.paidCents / row.totalCents) * 100} label={`${cad(row.paidCents)} of ${cad(row.totalCents)} paid`} height="h-1.5" />
            </span>
            <span className="text-xs whitespace-nowrap text-[#5b5370]">
              {`${dollars(row.paidCents) ?? ''} of ${dollars(row.totalCents) ?? ''}`}
            </span>
          </span>
        ) : null}
      </span>
      <span className="hidden truncate text-sm text-[#3b3352] md:block">{row.venue || 'No venue yet'}</span>
      <span className="hidden md:block">
        <Chip tone={row.mine ? statusTone(row.status) : row.status === 'released' ? 'red' : 'gray'}>
          {row.mine ? statusLabel(row.status) : row.status === 'released' ? 'Released' : 'Pynx'}
        </Chip>
      </span>
      <span className="hidden md:block">
        {row.mine ? (
          row.totalCents > 0 ? (
            <span className="grid gap-1">
              <Bar value={(row.paidCents / row.totalCents) * 100} label={`${cad(row.paidCents)} of ${cad(row.totalCents)} paid`} height="h-1.5" />
              <span className="text-[13px] text-[#5b5370]">
                {`${dollars(row.paidCents) ?? ''} of ${dollars(row.totalCents) ?? ''} paid`}</span>
            </span>
          ) : (
            <span className="text-[13px] text-[#5b5370]">No price yet</span>
          )
        ) : (
          <span className="text-[13px] text-[#5b5370]">Pynx pays you</span>
        )}
      </span>
      {row.bookingId ? (
        <ChevronRight className="h-5 w-5 text-[#d1006b]" aria-hidden="true" />
      ) : (
        <span aria-hidden="true" />
      )}
    </>
  )
  const grid =
    'grid min-h-[4.5rem] grid-cols-[3rem_minmax(0,1fr)_1.25rem] items-center gap-4 px-4 py-3 md:grid-cols-[3rem_minmax(0,1.3fr)_minmax(0,1fr)_6.5rem_minmax(0,1fr)_1.25rem] md:px-5'
  return row.bookingId ? (
    <Link to="/desk/bookings" search={{ couple: row.bookingId }} className={`${grid} text-[#1c1533] hover:bg-[#faf8fe]`}>
      {inner}
    </Link>
  ) : (
    <div className={grid}>{inner}</div>
  )
}

function MonthCalendar({ rows, today, start }: { rows: ListRow[]; today: string; start?: string }) {
  const [offset, setOffset] = useState(0)
  const base = start ?? today.slice(0, 7)
  const first = new Date(`${base}-01T12:00:00Z`)
  first.setUTCMonth(first.getUTCMonth() + offset)
  const y = first.getUTCFullYear()
  const m = first.getUTCMonth()
  const key = `${y}-${String(m + 1).padStart(2, '0')}`
  const days = new Date(Date.UTC(y, m + 1, 0)).getUTCDate()
  const lead = (first.getUTCDay() + 6) % 7
  const inMonth = rows.filter((row) => row.date.startsWith(key))
  const cells: (string | null)[] = [
    ...Array.from({ length: lead }, () => null),
    ...Array.from({ length: days }, (_, index) => `${key}-${String(index + 1).padStart(2, '0')}`),
  ]
  while (cells.length % 7 !== 0) cells.push(null)
  const title = first.toLocaleDateString('en-CA', { month: 'long', year: 'numeric', timeZone: 'UTC' })

  return (
    <section aria-labelledby="calendar-month" className={`${deskCard} grid gap-4`}>
      <div className="flex items-center justify-between gap-3">
        <h2 id="calendar-month" className="font-display text-2xl font-extrabold tracking-tight md:text-3xl">
          {title}
        </h2>
        <div className="flex gap-2">
          <button type="button" aria-label="Previous month" className={`${deskGhost} !px-3`} onClick={() => setOffset((n) => n - 1)}>
            <ChevronLeft className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
          <button type="button" className={`${deskGhost} hidden sm:inline-flex`} onClick={() => setOffset(0)}>
            This month
          </button>
          <button type="button" aria-label="Next month" className={`${deskGhost} !px-3`} onClick={() => setOffset((n) => n + 1)}>
            <ChevronRight className="h-4.5 w-4.5" aria-hidden="true" />
          </button>
        </div>
      </div>
      <div className="grid grid-cols-7 gap-1 md:gap-1.5">
        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day) => (
          <span key={day} className="px-1 text-center text-[11px] font-bold tracking-[0.1em] text-[#5b5370] uppercase md:text-left md:px-2">
            <span className="md:hidden">{day.charAt(0)}</span>
            <span className="hidden md:inline">{day}</span>
          </span>
        ))}
        {cells.map((iso, index) => {
          if (!iso) return <span key={`e-${index}`} />
          const events = inMonth.filter((row) => row.date === iso)
          const isToday = iso === today
          const weekend = index % 7 >= 5
          const mine = events.find((row) => row.mine)
          return (
            <div
              key={iso}
              className={`grid min-h-10 content-start gap-1 rounded-[10px] p-1 text-sm md:min-h-24 md:rounded-xl md:p-2 ${
                isToday
                  ? 'border-2 border-[#ff007f] bg-[#fff5fa]'
                  : `border border-[#f0ebf8] ${weekend ? 'bg-[#f7f4fd]' : 'bg-[#fcfbfe]'}`
              } ${events.length > 0 ? (mine ? 'max-md:bg-[#d1006b] max-md:text-white' : 'max-md:bg-[#e2dbf5]') : ''}`}
            >
              <span className={`text-center text-[13px] font-semibold md:text-left ${isToday ? 'text-[#d1006b]' : ''} ${events.length ? 'max-md:font-extrabold' : ''}`}>
                {Number(iso.slice(8))}
              </span>
              {events.map((row) =>
                row.bookingId ? (
                  <Link
                    key={row.key}
                    to="/desk/bookings"
                    search={{ couple: row.bookingId }}
                    className="hidden truncate rounded-md bg-[#d1006b] px-2 py-1 text-xs font-semibold !text-white md:block"
                  >
                    {row.couple}
                  </Link>
                ) : (
                  <span key={row.key} className="hidden truncate rounded-md bg-[#e2dbf5] px-2 py-1 text-xs font-semibold text-[#2f2550] md:block">
                    {row.couple}
                  </span>
                ),
              )}
            </div>
          )
        })}
      </div>
      {inMonth.length > 0 ? (
        <ul className="grid gap-1 border-t border-[#f0ebf8] pt-3 md:hidden">
          {inMonth.map((row) => (
            <li key={row.key} className="flex min-h-11 items-center gap-3">
              <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${row.mine ? 'bg-[#d1006b]' : 'bg-[#b3a6dc]'}`} aria-hidden="true" />
              <span className="w-16 text-[13px] font-bold text-[#4a4262]">
                {new Date(`${row.date}T12:00:00Z`).toLocaleDateString('en-CA', { weekday: 'short', day: 'numeric', timeZone: 'UTC' })}
              </span>
              {row.bookingId ? (
                <Link to="/desk/bookings" search={{ couple: row.bookingId }} className="font-semibold text-[#1c1533]">
                  {row.couple}
                </Link>
              ) : (
                <span className="font-semibold">{row.couple}</span>
              )}
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-[#5b5370]">Nothing booked this month.</p>
      )}
      <p className="flex flex-wrap gap-4 text-[13px] text-[#4a4262]">
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#d1006b]" aria-hidden="true" />
          Your wedding
        </span>
        <span className="inline-flex items-center gap-1.5">
          <span className="h-3 w-3 rounded bg-[#e2dbf5]" aria-hidden="true" />
          For Pynx
        </span>
      </p>
    </section>
  )
}

/** One couple: where things stand, their money, the day, their plan, and every tool. */
function CouplePage({ booking }: { booking: BookingRow }) {
  const { payments, packages, venues, plans } = deskRoute.useLoaderData()
  const today = todayInToronto()
  const [copied, setCopied] = useState('')
  const own = payments
    .filter((payment) => payment.bookingId === booking.id)
    .sort((a, b) => (a.paidOn || '').localeCompare(b.paidOn || '') || a.id - b.id)
  const plan = (plans ?? []).find((row) => row.bookingId === booking.id)
  const offer = packages.find((item) => item.id === booking.packageId)
  const invoice = booking.invoice
  const total = invoice?.totalCents ?? booking.totalCents
  const paid = Math.max(0, invoice?.receivedCents ?? 0)
  const left = Math.max(0, invoice ? invoice.balanceCents : total)
  const deposit = invoice?.depositCents ?? booking.depositCents
  const days = daysUntil(today, booking.eventDate)
  const travelFee = booking.travel.feeCents ?? 0
  const base = total + booking.discountCents - travelFee
  const sent = invoice ? invoice.status === 'sent' : false
  const firstPaid = own.find((payment) => payment.cents > 0)
  const depositDone = paid > 0 && paid >= deposit
  const hasContact = booking.email.trim() !== '' || booking.phone.trim() !== ''

  const steps: { name: string; note: string; state: 'done' | 'now' | 'later' }[] = [
    { name: 'Inquiry', note: 'Came in', state: 'done' },
    {
      name: 'Invoice sent',
      note: invoice ? (invoice.status === 'void' ? 'Void' : `${dollars(total)} total`) : 'No invoice yet',
      state: sent ? 'done' : 'now',
    },
    {
      name: 'Deposit paid',
      note: depositDone
        ? `${dollars(paid >= deposit ? deposit : paid)}${firstPaid?.paidOn ? ` on ${shortDay(firstPaid.paidOn)}` : ''}`
        : `${dollars(deposit)} due`,
      state: depositDone ? 'done' : sent ? 'now' : 'later',
    },
    {
      name: 'Balance',
      note: left === 0 && total > 0 ? 'Paid in full' : `${dollars(left)} to go`,
      state: left === 0 && total > 0 ? 'done' : depositDone ? 'now' : 'later',
    },
    {
      name: 'Wedding day',
      note: shortDay(booking.eventDate),
      state: days < 0 ? 'done' : 'later',
    },
  ]

  function copy(kind: string, path: string) {
    void navigator.clipboard?.writeText(`${window.location.origin}${path}`).then(() => {
      setCopied(kind)
      window.setTimeout(() => setCopied(''), 2000)
    })
  }

  const day = new Date(`${booking.eventDate}T12:00:00Z`)
  const when = days < 0 ? `${-days} days ago` : days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`

  return (
    <div className="grid gap-5">
      <Link to="/desk/bookings" className="inline-flex min-h-10 w-fit items-center gap-1.5 text-sm font-semibold text-[#d1006b] hover:underline">
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        All bookings
      </Link>

      <header className="grid overflow-hidden rounded-[20px] bg-[#1c1533] text-[#fff] shadow-[0_18px_40px_-24px_rgba(28,21,51,0.6)] sm:grid-cols-[8.5rem_minmax(0,1fr)]">
        <div className="flex items-center justify-between gap-3 bg-[#ff007f] px-5 py-3 text-[#1c1533] sm:flex-col sm:justify-center sm:gap-0.5 sm:py-6 sm:text-center">
          <span className="text-[13px] font-bold tracking-[0.16em]">
            {day.toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()}
          </span>
          <span className="font-display text-3xl leading-[0.9] font-extrabold tracking-[-0.04em] sm:text-[64px]">
            {day.getUTCDate()}
          </span>
          <span className="text-[13px] font-bold tracking-[0.16em]">
            {day.toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' }).toUpperCase()}{` ${day.getUTCFullYear() ?? ''}`}
          </span>
        </div>
        <div className="flex flex-wrap items-center justify-between gap-5 border-[#4b3f72] p-5 sm:border-l-2 sm:border-dashed sm:p-7">
          <div className="grid min-w-0 gap-1.5">
            <span className="flex flex-wrap gap-2">
              <span className={`rounded-md px-2 py-0.5 text-[11px] font-bold tracking-[0.1em] uppercase ${
                booking.status === 'booked' ? 'bg-[#7ee2b0] text-[#0b3d2a]' : booking.status === 'hold' ? 'bg-[#ffd27a] text-[#4a2e00]' : booking.status === 'cancelled' || booking.status === 'released' ? 'bg-rose-200 text-rose-900' : 'bg-[#e2dbf5] text-[#2f2550]'
              }`}>
                {statusLabel(booking.status)}
              </span>
              {booking.sample ? (
                <span className="rounded-md bg-rose-200 px-2 py-0.5 text-[11px] font-bold tracking-[0.1em] text-rose-900 uppercase">Test</span>
              ) : null}
            </span>
            <h1 className="font-display text-[36px] leading-[1.02] font-extrabold tracking-[-0.02em] md:text-[52px]">
              <CoupleName one={booking.partnerOne} two={booking.partnerTwo} amp="text-[#ff8cc6]" />
            </h1>
            <p className="text-[#d9d0ea]">
              {[when, booking.venueName, booking.packageName].filter(Boolean).join(' · ')}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <a href="#everything" className="inline-flex min-h-11 items-center rounded-lg border border-[#5a4c86] px-4 font-semibold !text-white hover:bg-white/8">
              Edit details
            </a>
            <Link
              to="/desk/portals/$slug/plan"
              params={{ slug: booking.slug }}
              className="inline-flex min-h-11 items-center rounded-lg border border-[#5a4c86] px-4 font-semibold !text-white hover:bg-white/8"
            >
              Their plan
            </Link>
            <Link to="/desk/money" className="inline-flex min-h-11 items-center rounded-lg bg-[#ff007f] px-4 font-bold text-[#1c1533] hover:bg-[#ff3d9a]">
              Record a payment
            </Link>
          </div>
        </div>
      </header>

      <ol aria-label="Where this booking is" className="grid gap-3 rounded-[20px] border border-[#e6def4] bg-white p-5 sm:grid-cols-5">
        {steps.map((step) => (
          <li key={step.name} className="grid grid-cols-[1.5rem_minmax(0,1fr)] items-center gap-x-3 sm:grid-cols-1 sm:gap-2">
            <span
              className={`hidden h-1.5 rounded-full sm:block ${step.state === 'done' ? 'bg-[#0f7b55]' : step.state === 'now' ? 'bg-[#ff007f]' : 'bg-[#eee8f7]'}`}
              aria-hidden="true"
            />
            <span
              className={`grid h-6 w-6 place-items-center rounded-full sm:hidden ${
                step.state === 'done' ? 'bg-[#0f7b55] text-white' : step.state === 'now' ? 'border-[3px] border-[#ff007f] bg-white' : 'border-2 border-[#d6cce8] bg-white'
              }`}
              aria-hidden="true"
            >
              {step.state === 'done' ? <Check className="h-3.5 w-3.5" /> : null}
            </span>
            <span className="flex flex-wrap items-baseline justify-between gap-x-2 sm:grid sm:gap-0.5">
              <span className="flex items-center gap-1.5 font-semibold">
                {step.state === 'done' ? <Check className="hidden h-4 w-4 text-[#0f7b55] sm:inline" aria-hidden="true" /> : null}
                {step.name}
                <span className="sr-only">{step.state === 'done' ? ', done' : step.state === 'now' ? ', next' : ''}</span>
              </span>
              <span className="text-sm text-[#5b5370]">{step.note}</span>
            </span>
          </li>
        ))}
      </ol>

      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <div className="grid gap-5">
          <section aria-labelledby="couple-money" className={`${deskCard} grid gap-4`}>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p id="couple-money" className={deskKicker}>Money</p>
                <p className="mt-1 flex flex-wrap items-baseline gap-2">
                  <span className="font-display text-5xl leading-none font-extrabold tracking-[-0.03em] text-[#1c1533] tabular-nums">
                    {dollars(left)}
                  </span>
                  <span className="text-[#5b5370]">{`left of ${dollars(total) ?? ''}`}</span>
                </p>
              </div>
              {invoice ? <Chip tone={invoiceTone(invoice.status)}>{`Invoice ${invoice.status ?? ''}`}</Chip> : <Chip>No invoice</Chip>}
            </div>
            <Bar value={total > 0 ? (paid / total) * 100 : 0} label={`${cad(paid)} of ${cad(total)} paid`} height="h-2.5" />
            <div className="grid gap-5 sm:grid-cols-2">
              <dl className="grid grid-cols-[1fr_auto] content-start gap-x-4 gap-y-1.5 text-sm">
                <dt className="text-[#5b5370]">{booking.packageName}</dt>
                <dd className="text-right tabular-nums">{cad(base)}</dd>
                {booking.discountCents > 0 ? (
                  <>
                    <dt className="text-[#5b5370]">Discount</dt>
                    <dd className="text-right tabular-nums">{`−${cad(booking.discountCents) ?? ''}`}</dd>
                  </>
                ) : null}
                <dt className="text-[#5b5370]">Travel</dt>
                <dd className="text-right tabular-nums">
                  {booking.travel.feeCents == null ? 'Not worked out' : booking.travel.feeCents === 0 ? 'Included' : cad(booking.travel.feeCents)}
                </dd>
                <dt className="border-t border-[#eee8f7] pt-1.5 font-bold">Total</dt>
                <dd className="border-t border-[#eee8f7] pt-1.5 text-right font-bold tabular-nums">{cad(total)}</dd>
              </dl>
              <div className="grid content-start gap-2">
                <p className="text-xs font-bold tracking-[0.14em] text-[#6b5fa0] uppercase">Payments</p>
                {own.length === 0 ? (
                  <p className="text-sm text-[#5b5370]">Nothing paid yet.</p>
                ) : (
                  own.map((payment) => (
                    <p
                      key={payment.id}
                      className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 text-sm ${payment.cents < 0 ? 'bg-rose-50' : 'bg-[#f1faf5]'}`}
                    >
                      <span>
                        <span className="block font-semibold">{payment.cents < 0 ? 'Refund' : payment.note || 'Payment'}</span>
                        <span className="text-[#5b5370]">
                          {[payment.paidOn ? shortDay(payment.paidOn) : '', METHOD_NAME[payment.method] ?? ''].filter(Boolean).join(' · ')}
                        </span>
                      </span>
                      <span className={`font-bold tabular-nums ${payment.cents < 0 ? 'text-rose-700' : 'text-[#0b5e41]'}`}>
                        {cad(payment.cents)}
                      </span>
                    </p>
                  ))
                )}
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <Link to="/desk/money" className={deskDark}>
                Record a payment
              </Link>
              {invoice ? (
                <>
                  <button type="button" className={deskGhost} onClick={() => copy('pay', `/p/${invoice.slug}`)}>
                    {copied === 'pay' ? 'Pay link copied' : 'Copy pay link'}
                  </button>
                  <Link to="/p/$slug" params={{ slug: invoice.slug }} className={deskGhost}>
                    Invoice page
                  </Link>
                </>
              ) : null}
            </div>
          </section>

          <section aria-labelledby="couple-day" className={`${deskCard} grid gap-4`}>
            <div>
              <p className={deskKicker}>The day</p>
              <h2 id="couple-day" className={`${deskH2} mt-1`}>
                {booking.venueName || 'No venue yet'}
              </h2>
              {booking.venueStreet ? (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${booking.venueName} ${booking.venueStreet}`)}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm text-[#d1006b] underline underline-offset-2"
                >
                  {booking.venueStreet}
                </a>
              ) : (
                <p className="text-sm text-[#5b5370]">Add the venue name and street below. The hold starts when both are in.</p>
              )}
              {booking.venueTwoName ? (
                <p className="mt-2 text-sm text-[#4a4262]">{`Ceremony at ${booking.venueTwoName ?? ''}`}
                  {booking.venueTwoStreet ? `, ${booking.venueTwoStreet}` : ''}
                </p>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="rounded-2xl border border-[#efe9f8] bg-[#faf8fe] p-4">
                <p className="font-semibold">{booking.packageName}</p>
                {offer?.detail ? <p className="mt-1 text-sm text-[#4a4262]">{offer.detail}</p> : null}
                {booking.withStag && booking.stagDate ? (
                  <p className="mt-2 text-sm text-[#4a4262]">{`Stag and doe on ${longDate(booking.stagDate) ?? ''}.`}</p>
                ) : null}
                {booking.uplights > 0 ? (
                  <p className="mt-1 text-sm text-[#4a4262]">{`${booking.uplights ?? ''} uplights.`}</p>
                ) : null}
              </div>
              <TravelPanel booking={booking} />
            </div>
          </section>
        </div>

        <div className="grid gap-5">
          <section aria-labelledby="couple-contact" className={`${deskCard} grid gap-3`}>
            <h2 id="couple-contact" className={deskH2}>
              The couple
            </h2>
            {hasContact ? (
              <div className="grid gap-1">
                {booking.email ? (
                  <a href={`mailto:${booking.email}`} className="flex min-h-11 items-center gap-2.5 text-[#1c1533] hover:text-[#d1006b]">
                    <Mail className="h-4.5 w-4.5 text-[#d1006b]" aria-hidden="true" />
                    {booking.email}
                  </a>
                ) : null}
                {booking.phone ? (
                  <a href={`tel:${booking.phone.replace(/[^\d+]/g, '')}`} className="flex min-h-11 items-center gap-2.5 text-[#1c1533] hover:text-[#d1006b]">
                    <Phone className="h-4.5 w-4.5 text-[#d1006b]" aria-hidden="true" />
                    {booking.phone}
                  </a>
                ) : null}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-[#f3b6d3] bg-[#fff5fa] p-4">
                <p className="font-semibold">No email or phone yet</p>
                <p className="mt-1 text-sm text-[#4a4262]">
                  Add one so the invoice, card link and portal link can reach them.
                </p>
                <a href="#everything" className={`${deskPrimary} mt-3`}>
                  Add their contact
                </a>
              </div>
            )}
          </section>

          <section aria-labelledby="couple-plan" className={`${deskCard} grid gap-3`}>
            <div className="flex items-baseline justify-between gap-3">
              <h2 id="couple-plan" className={deskH2}>
                Their plan
              </h2>
              {plan ? <span className="font-display text-2xl font-extrabold text-[#d1006b]">{`${plan.percent ?? ''}%`}</span> : null}
            </div>
            {plan ? (
              <>
                <Bar value={plan.percent} label={`${plan.percent}% planned`} color="bg-[#ff007f]" />
                <p className="text-sm text-[#4a4262]">
                  {`${plan.answered ?? ''} of ${plan.total ?? ''} answers in.`}</p>
              </>
            ) : (
              <p className="text-sm text-[#5b5370]">Their plan has not started.</p>
            )}
            <div className="flex flex-wrap gap-2">
              <Link to="/desk/portals/$slug/plan" params={{ slug: booking.slug }} className={deskGhost}>
                Open plan sheet
              </Link>
              <button type="button" className={deskGhost} onClick={() => copy('portal', `/c/${booking.slug}`)}>
                {copied === 'portal' ? 'Portal link copied' : 'Copy portal link'}
              </button>
            </div>
          </section>

          <NotesCard id={booking.id} notes={booking.notes} />
        </div>
      </div>

      <section id="everything" aria-labelledby="everything-title" className="grid scroll-mt-20 gap-3">
        <h2 id="everything-title" className="font-display text-xl font-extrabold">
          Details, invoice and status
        </h2>
        <p className="text-sm text-[#5b5370]">
          Edit their names, contact, date, venue and price; send or void the invoice; release, cancel or
          delete the booking.
        </p>
        <BookingCard
          booking={booking}
          packages={packages}
          venues={venues}
          payments={own}
          startOpen
          hideTravel
        />
      </section>
    </div>
  )
}

const METHOD_NAME: Record<string, string> = {
  card: 'Card',
  'e-transfer': 'E-transfer',
  cash: 'Cash',
}

function shortDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function NotesCard({ id, notes }: { id: number; notes: string }) {
  const save = useServerFn(saveNotes)
  const router = useRouter()
  const [value, setValue] = useState(notes)
  const [state, setState] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle')
  const dirty = value !== notes
  async function commit() {
    if (!dirty) return
    setState('saving')
    const result = await save({ data: { id, notes: value } }).catch(() => ({ ok: false as const }))
    setState(result.ok ? 'saved' : 'error')
    if (result.ok) await router.invalidate()
  }
  return (
    <section aria-labelledby={`notes-${id}`} className={`${deskCard} grid gap-2`}>
      <h2 id={`notes-${id}`} className={deskH2}>
        Your notes
      </h2>
      <label htmlFor={`notes-text-${id}`} className="text-sm text-[#5b5370]">
        Only you see these
      </label>
      <textarea
        id={`notes-text-${id}`}
        rows={4}
        maxLength={2000}
        value={value}
        placeholder="Load-in, parking, who to call on the day"
        onChange={(event) => {
          setValue(event.target.value)
          setState('idle')
        }}
        onBlur={() => void commit()}
      />
      <div className="flex items-center gap-3">
        <button type="button" className={deskGhost} disabled={!dirty || state === 'saving'} onClick={() => void commit()}>
          {state === 'saving' ? 'Saving…' : 'Save notes'}
        </button>
        <span className="text-sm text-[#5b5370]" role="status">
          {state === 'saved' ? 'Saved.' : state === 'error' ? 'That did not save. Try again.' : ''}
        </span>
      </div>
    </section>
  )
}

function NewBooking({
  packages,
  venues,
  startOpen = false,
  prefill,
}: {
  packages: { id: string; name: string; cents: number }[]
  venues: SavedVenue[]
  startOpen?: boolean
  /** Filled in from an inquiry. */
  prefill?: {
    partnerOne: string
    partnerTwo: string
    email: string
    emailTwo?: string
    phone: string
    eventDate: string
    stagDate: string
    withStag: boolean
    packageId: string
  }
}) {
  const add = useServerFn(addBooking)
  const router = useRouter()
  const prices = priceRecord(packages)
  const [error, setError] = useState<string | null>(null)
  const [packageId, setPackageId] = useState(
    prefill && isPackageId(prefill.packageId) ? prefill.packageId : 'full',
  )
  const [open, setOpen] = useState(startOpen)
  const [draft, setDraft] = useState(0)
  const [preview, setPreview] = useState(() => ({
    ...quote(
      { packageId: 'full', withStag: false, uplights: 0, venueKm: [] },
      prices,
    ),
    discountCents: 0,
  }))

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
          setError(null)
        }}
        onSubmit={(event) => event.preventDefault()}
      >
        <BookingFields
          key={draft}
          packageId={packageId}
          onPackage={(value) => setPackageId(value as typeof packageId)}
          packages={packages}
          venues={venues}
          defaults={
            prefill && draft === 0
              ? {
                  partnerOne: prefill.partnerOne,
                  partnerTwo: prefill.partnerTwo,
                  email: prefill.email,
                  phone: prefill.phone,
                  eventDate: prefill.eventDate,
                  stagDate: prefill.stagDate,
                  withStag: prefill.withStag,
                  uplights: 0,
                  kmOne: '',
                  kmTwo: '',
                  venueName: '',
                  venueStreet: '',
                  venueTwoName: '',
                  venueTwoStreet: '',
                  sample: false,
                  notes: '',
                  discountCents: 0,
                  customTotalCents: 0,
                  lockedTotal: false,
                }
              : undefined
          }
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
              {preview.discountCents > 0 ? (
                <p className="text-xs text-white/65">
                  {`${cad(preview.discountCents) ?? ''} off`}</p>
              ) : null}
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
            {DESK_TRAVEL_COPY}
            {preview.hotel
              ? ' A hotel is also required for this distance.'
              : ''}
          </p>
          <ActionButton
            className={deskPrimary}
            checkForm
            busy="Saving…"
            done="Saved"
            surface={deskSurface}
            onRun={async (
              form: FormData,
              formElement: HTMLFormElement | null,
            ): Promise<RunResult | undefined> => {
              const withStag = form.get('withStag') === 'on'
              const discount = readDiscount(form)
              if (!discount.ok) {
                setError(discount.error)
                return
              }
              const result = await add({
                data: {
                  partnerOne: String(form.get('partnerOne') ?? ''),
                  partnerTwo: String(form.get('partnerTwo') ?? ''),
                  email: String(form.get('email') ?? ''),
                  emailTwo: String(form.get('emailTwo') ?? ''),
                  phone: String(form.get('phone') ?? ''),
                  eventDate: String(form.get('eventDate') ?? ''),
                  stagDate: withStag
                    ? String(form.get('stagDate') ?? '')
                    : null,
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
                  discountCents: discount.cents,
                  customTotalCents: customCents(form),
                  lockedTotal: form.get('lockedTotal') === 'on',
                },
              })
              if (!result.ok) {
                setError(result.error)
                return
              }
              setError(null)
              setOpen(false)
              formElement?.reset()
              setDraft((value) => value + 1)
              setPackageId('full')
              setPreview({
                ...quote(
                  {
                    packageId: 'full',
                    withStag: false,
                    uplights: 0,
                    venueKm: [],
                  },
                  prices,
                ),
                discountCents: 0,
              })
              await router.invalidate()
              return { ok: result.ok, message: 'Saved.' }
            }}
          >
            Save as open
          </ActionButton>
        </div>
      </form>
    </section>
  )
}

function ExternalDates({
  dates,
  venues,
}: {
  dates: ExternalDate[]
  venues: SavedVenue[]
}) {
  const add = useServerFn(addExternalDate)
  const release = useServerFn(releaseExternal)
  const remove = useServerFn(deleteExternal)
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [draft, setDraft] = useState(0)
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmId, setConfirmId] = useState<number | null>(null)
  const active = dates.filter((row) => !row.released)
  const released = dates.filter((row) => row.released)

  return (
    <section className={deskCard}>
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
          {'Dates for another company '}
          {active.length > 0 ? (
            <span className="text-sm font-normal text-white/65">
              {`${active.length ?? ''} on the book`}</span>
          ) : null}
        </span>
      </button>
      <p className={open ? 'mt-3 text-sm text-white/65' : 'hidden'}>
        A wedding or other event you play for another company. The date is
        booked. There is no invoice.
      </p>
      <form
        className={open ? 'mt-5 grid gap-4' : 'hidden'}
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <label className="grid gap-1 text-sm">
            Date
            <input
              name="eventDate"
              type="date"
              required
              className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            What it is
            <select
              name="kind"
              defaultValue="wedding"
              className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
            >
              <option value="wedding">Wedding</option>
              <option value="event">Event</option>
            </select>
          </label>
          <label className="grid gap-1 text-sm">
            Company
            <input
              name="company"
              required
              maxLength={80}
              className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Who or what
            <input
              name="label"
              maxLength={80}
              className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            First partner
            <input
              name="partnerOne"
              maxLength={80}
              className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Second partner
            <input
              name="partnerTwo"
              maxLength={80}
              className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
            />
          </label>
          <VenuePair
            key={draft}
            venues={venues}
            chooseLabel="Choose a venue"
            nameLabel="Venue name"
            streetLabel="Venue address"
            nameField="venueName"
            streetField="venueStreet"
            secondChooseLabel="Choose a second venue"
            secondNameLabel="Second venue name"
            secondStreetLabel="Second venue address"
            secondNameField="venueTwoName"
            secondStreetField="venueTwoStreet"
            span="sm:col-span-2"
            labelClass="grid gap-1 text-sm"
            inputClass="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
          />
        </div>
        <label className="grid gap-1 text-sm">
          Note
          <textarea
            name="notes"
            maxLength={500}
            rows={2}
            className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
          />
        </label>
        {error ? <p className="text-sm text-rose-300">{error}</p> : null}
        <ActionButton
          className={deskPrimary}
          checkForm
          busy="Saving…"
          done="Saved"
          surface={deskSurface}
          onRun={async (
            form: FormData,
            formElement: HTMLFormElement | null,
          ): Promise<RunResult | undefined> => {
            const result = await add({
              data: {
                eventDate: String(form.get('eventDate') ?? ''),
                kind: String(form.get('kind') ?? ''),
                company: String(form.get('company') ?? ''),
                label: String(form.get('label') ?? ''),
                partnerOne: String(form.get('partnerOne') ?? ''),
                partnerTwo: String(form.get('partnerTwo') ?? ''),
                venueName: String(form.get('venueName') ?? ''),
                venueStreet: String(form.get('venueStreet') ?? ''),
                venueTwoName: String(form.get('venueTwoName') ?? ''),
                venueTwoStreet: String(form.get('venueTwoStreet') ?? ''),
                notes: String(form.get('notes') ?? ''),
              },
            })
            if (!result.ok) {
              setNotice(null)
              setError(result.error)
              return
            }
            setError(null)
            setNotice('Booked. The date is taken.')
            setOpen(false)
            formElement?.reset()
            setDraft((value) => value + 1)
            await router.invalidate()
            return { ok: result.ok, message: 'Saved.' }
          }}
        >
          Book this date
        </ActionButton>
      </form>
      {notice ? <p className="mt-4 text-sm text-white">{notice}</p> : null}
      {dates.length === 0 ? (
        <p className="mt-4 text-sm text-white/65">No external dates yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/10">
          {[...active, ...released].map((row) => (
            <li
              key={row.id}
              className="flex flex-wrap items-center justify-between gap-3 py-3"
            >
              <div className="min-w-0">
                <p className="font-semibold">
                  {row.company}
                  {externalCouple(row) ? ` · ${externalCouple(row)}` : ''}
                </p>
                <p className="text-sm text-white/65">
                  {`${longDate(row.eventDate) ?? ''} · ${externalKindLabel(row.kind) ?? ''}`}
                  {row.notes ? ` · ${row.notes}` : ''}
                </p>
                {externalVenues(row).map((venue) => (
                  <p key={venue} className="text-sm text-white/65">
                    {venue}
                  </p>
                ))}
                {row.released ? (
                  <p className="text-sm text-white/55">
                    A released date stays released.
                  </p>
                ) : null}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {row.released ? (
                  <Chip tone="gray">released</Chip>
                ) : (
                  <button
                    type="button"
                    className={deskGhost}
                    onClick={() => {
                      void release({ data: { id: row.id } }).then(
                        async (result) => {
                          if (!result.ok) {
                            setNotice(null)
                            setError(result.error)
                            return
                          }
                          setError(null)
                          setNotice('Released. A released date stays released.')
                          await router.invalidate()
                        },
                      )
                    }}
                  >
                    Release
                  </button>
                )}
                {confirmId === row.id ? (
                  <>
                    <button
                      type="button"
                      className={deskDanger}
                      onClick={() => {
                        void remove({ data: { id: row.id } }).then(
                          async (result) => {
                            if (!result.ok) {
                              setNotice(null)
                              setError(result.error)
                              return
                            }
                            setConfirmId(null)
                            setError(null)
                            setNotice('Deleted. The date is open.')
                            await router.invalidate()
                          },
                        )
                      }}
                    >
                      Delete this date
                    </button>
                    <button
                      type="button"
                      className={deskGhost}
                      onClick={() => setConfirmId(null)}
                    >
                      Keep it
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    className={deskDanger}
                    onClick={() => setConfirmId(row.id)}
                  >
                    Delete
                  </button>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function VenueRow({
  venue,
  onError,
  onNotice,
}: {
  venue: SavedVenue
  onError: (message: string | null) => void
  onNotice: (message: string | null) => void
}) {
  const edit = useServerFn(editVenue)
  const remove = useServerFn(deleteVenue)
  const router = useRouter()
  const [open, setOpen] = useState(false)

  return (
    <li className="py-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold">{venue.name}</p>
          <p className="text-sm text-white/65">
            {venue.street || 'No address yet'}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            className={deskGhost}
            onClick={() => setOpen((value) => !value)}
          >
            {open ? 'Close' : 'Edit'}
          </button>
          <button
            type="button"
            className={deskDanger}
            onClick={() => {
              void remove({ data: { id: venue.id } }).then(async (result) => {
                if (!result.ok) {
                  onNotice(null)
                  onError(result.error)
                  return
                }
                onError(null)
                onNotice('Removed from the list.')
                await router.invalidate()
              })
            }}
          >
            Delete
          </button>
        </div>
      </div>
      {open ? (
        <form
          className="mt-3 grid gap-3 sm:grid-cols-2"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="grid gap-1 text-sm">
            Venue name
            <input
              name="name"
              required
              maxLength={160}
              defaultValue={venue.name}
              className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
            />
          </label>
          <label className="grid gap-1 text-sm">
            Venue address
            <input
              name="street"
              maxLength={160}
              defaultValue={venue.street}
              className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
            />
          </label>
          <div className="sm:col-span-2">
            <ActionButton
              className={deskPrimary}
              checkForm
              busy="Saving…"
              done="Saved"
              surface={deskSurface}
              onRun={async (form: FormData): Promise<RunResult | undefined> => {
                const result = await edit({
                  data: {
                    id: venue.id,
                    name: String(form.get('name') ?? ''),
                    street: String(form.get('street') ?? ''),
                  },
                })
                if (!result.ok) {
                  onNotice(null)
                  onError(result.error)
                  return
                }
                onError(null)
                onNotice('Saved. That venue is updated.')
                setOpen(false)
                await router.invalidate()
                return { ok: result.ok, message: 'Saved.' }
              }}
            >
              Save changes
            </ActionButton>
          </div>
        </form>
      ) : null}
    </li>
  )
}

function SavedVenues({ venues }: { venues: SavedVenue[] }) {
  const add = useServerFn(addVenue)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <details className={`${deskCard} group`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-display text-xl font-bold [&::-webkit-details-marker]:hidden">
        <span>
          {"Saved venues "}
          <span className="text-sm font-normal text-white/65">
            {venues.length}
          </span>
        </span>
        <ChevronDown
          className="desk-motion h-5 w-5 text-white/40 group-open:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <p className="mt-3 text-sm text-white/65">
        Every venue on the book is kept here. Pick one on a booking or an
        external date and the address fills in. Edit changes the name and the
        address. Saving the same name updates the address. Delete removes it
        from this list until that name is saved again.
      </p>
      <form
        className="mt-5 grid gap-4 sm:grid-cols-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="grid gap-1 text-sm">
          Venue name
          <input
            name="name"
            required
            maxLength={160}
            className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
          />
        </label>
        <label className="grid gap-1 text-sm">
          Venue address
          <input
            name="street"
            maxLength={160}
            className="rounded-lg border border-white/15 bg-ink-950 px-3 py-2"
          />
        </label>
        <div className="sm:col-span-2">
          <ActionButton
            className={deskPrimary}
            checkForm
            busy="Saving…"
            done="Saved"
            surface={deskSurface}
            onRun={async (
              form: FormData,
              formElement: HTMLFormElement | null,
            ): Promise<RunResult | undefined> => {
              const result = await add({
                data: {
                  name: String(form.get('name') ?? ''),
                  street: String(form.get('street') ?? ''),
                },
              })
              if (!result.ok) {
                setNotice(null)
                setError(result.error)
                return
              }
              setError(null)
              setNotice('Saved. That venue is on the list.')
              formElement?.reset()
              await router.invalidate()
              return { ok: result.ok, message: 'Saved.' }
            }}
          >
            Save venue
          </ActionButton>
        </div>
      </form>
      {error ? <p className="mt-4 text-sm text-rose-300">{error}</p> : null}
      {notice ? <p className="mt-4 text-sm text-white">{notice}</p> : null}
      {venues.length === 0 ? (
        <p className="mt-4 text-sm text-white/65">No venues yet.</p>
      ) : (
        <ul className="mt-4 divide-y divide-white/10">
          {venues.map((venue) => (
            <VenueRow
              key={venue.id}
              venue={venue}
              onError={setError}
              onNotice={setNotice}
            />
          ))}
        </ul>
      )}
    </details>
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
  const rawDiscount = String(data.get('discount') ?? '').trim()
  try {
    const discountCents = rawDiscount ? dollarsToCents(rawDiscount) : 0
    if (packageId === 'custom') {
      const rawTotal = String(data.get('customTotal') ?? '').trim()
      const total = rawTotal ? dollarsToCents(rawTotal) : 0
      if (total <= 0 || discountCents > total) return null
      return {
        totalCents: total - discountCents,
        depositCents: deposit30(total),
        discountCents,
        hotel: false,
      }
    }
    const quoted = quote(
      {
        packageId,
        withStag: packageId === 'full' && data.get('withStag') === 'on',
        uplights,
        venueKm,
      },
      prices,
    )
    return applyDiscount(quoted, discountCents, {
      packageId,
      withStag: packageId === 'full' && data.get('withStag') === 'on',
    })
  } catch {
    return null
  }
}

function customCents(form: FormData): number {
  const raw = String(form.get('customTotal') ?? '').trim()
  if (!raw) return 0
  return dollarsToCents(raw)
}

function discountFrom(form: FormData): number {
  const raw = String(form.get('discount') ?? '').trim()
  if (!raw) return 0
  return dollarsToCents(raw)
}

function readDiscount(
  form: FormData,
): { ok: true; cents: number } | { ok: false; error: string } {
  try {
    return { ok: true, cents: discountFrom(form) }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'Enter a discount.',
    }
  }
}

function BookingCard({
  booking,
  payments,
  packages,
  venues,
  startOpen = false,
  hideTravel = false,
}: {
  startOpen?: boolean
  /** The couple page shows travel in The day, so the editor leaves it out. */
  hideTravel?: boolean
  packages: { id: string; name: string }[]
  venues: SavedVenue[]
  booking: {
    id: number
    slug: string
    partnerOne: string
    partnerTwo: string
    email: string
    emailTwo?: string
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
    discountCents: number
    customTotalCents: number
    lockedTotal: boolean
    holdStartedOn: string | null
    holdLastDay: string | null
    stagReleased: boolean
    notes: string
    travel: {
      km: number | null
      feeCents: number | null
      tier: string | null
      hotel: boolean
      source: string
      error: string
      stale: boolean
    }
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
  const remove = useServerFn(deleteBooking)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [confirmMail, setConfirmMail] = useState(false)
  const [packageId, setPackageId] = useState(booking.packageId)
  const [open, setOpen] = useState(startOpen)
  const [action, setAction] = useState('release')
  const formKey = `${booking.status}-${booking.invoice?.status}-${booking.invoice?.receivedCents}-${booking.holdLastDay}-${booking.notes}`
  const daysLeft =
    booking.status === 'hold' && booking.holdLastDay
      ? daysUntil(todayInToronto(), booking.holdLastDay)
      : null
  const controls = invoiceControls(booking.invoice?.status ?? null)
  const canMail = hasCoupleAddress(booking.email)

  async function updateStatus(
    form: FormData,
  ): Promise<{ ok: boolean; message: string }> {
    const next = String(form.get('action') ?? '')
    if (next !== 'release' && next !== 'cancel' && next !== 'release-stag') {
      return { ok: false, message: 'Pick a status action.' }
    }
    const result = await status({ data: { id: booking.id, action: next } })
    if (!result.ok) {
      setError(result.error)
      return { ok: false, message: result.error }
    }
    setError(null)
    const message = 'The status is updated.'
    setNotice(message)
    await router.invalidate()
    return { ok: true, message }
  }

  async function savePayment(
    form: FormData,
    kind: 'payment' | 'refund',
  ): Promise<{ ok: boolean; message: string }> {
    const refund = kind === 'refund'
    try {
      const cents = dollarsToCents(String(form.get('amount') ?? ''))
      const result = await pay({
        data: {
          id: booking.id,
          cents: refund ? -cents : cents,
          note: String(form.get('note') ?? ''),
        },
      })
      if (!result.ok) {
        setError(result.error)
        return { ok: false, message: result.error }
      }
      setError(null)
      const message = result.newlyBooked
        ? 'The deposit cleared. The date is booked.'
        : refund
          ? 'The refund is on the invoice. The date stays booked.'
          : 'The payment is on the invoice.'
      setNotice(message)
      await router.invalidate()
      return { ok: true, message }
    } catch (caught) {
      const message =
        caught instanceof Error ? caught.message : 'Enter an amount.'
      setError(message)
      return { ok: false, message }
    }
  }

  return (
    <article
      className={`rounded-2xl border bg-white shadow-[0_1px_2px_rgba(28,21,51,0.05)] ${open ? 'border-[#ff007f]/50' : 'border-[#e3dcf2]'}`}
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
              {`${booking.partnerOne ?? ''} and ${booking.partnerTwo ?? ''}`}
            </h2>
            {booking.sample ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">TEST<span className="sr-only">{'\u00a0'}</span></span>
            ) : null}
          </div>
          <p className="text-sm text-white/65">
            {`${longDate(booking.eventDate) ?? ''} · ${booking.packageName ?? ''}`}
            {booking.stagDate ? ` · stag ${longDate(booking.stagDate)}` : ''}
            {booking.stagReleased ? ' · stag released' : ''}
          </p>
          {booking.holdStartedOn && booking.holdLastDay ? (
            <p className="mt-1 text-sm text-white/65">{`Hold ${longDate(booking.holdStartedOn) ?? ''} through ${longDate(booking.holdLastDay) ?? ''}`}
            </p>
          ) : null}
          <MoneyBar
            totalCents={booking.invoice?.totalCents ?? booking.totalCents}
            depositCents={booking.invoice?.depositCents ?? booking.depositCents}
            receivedCents={booking.invoice?.receivedCents ?? 0}
            discountCents={booking.discountCents}
          />
        </div>
        <div className="flex flex-col items-end gap-1.5">
          <div className="flex gap-2">
            <Chip tone={statusTone(booking.status)}>{booking.status}</Chip>
            {booking.invoice ? (
              <Chip tone={invoiceTone(booking.invoice.status)}>{`invoice ${booking.invoice.status ?? ''}`}
              </Chip>
            ) : null}
          </div>
          {daysLeft !== null && booking.holdLastDay ? (
            <span
              className={`text-xs ${daysLeft < 10 ? 'font-semibold text-amber-700' : 'text-white/65'}`}
            >{`Hold ends ${longDate(booking.holdLastDay) ?? ''} · ${daysLeft ?? ''} days left`}</span>
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
          <Link
            to="/desk/portals/$slug/plan"
            params={{ slug: booking.slug }}
            className="font-semibold text-hot hover:underline"
          >
            Our plan
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
        {hideTravel ? null : <TravelPanel booking={booking} />}
        {open ? <PortalDeskFields slug={booking.slug} /> : null}
        <form
          key={formKey}
          className="grid gap-3"
          onChange={() => setError(null)}
          onSubmit={(event) => event.preventDefault()}
        >
          <BookingFields
            packageId={packageId}
            onPackage={setPackageId}
            packages={packages}
            venues={venues}
            columns={3}
            defaults={{
              partnerOne: booking.partnerOne,
              partnerTwo: booking.partnerTwo,
              email: booking.email,
              emailTwo: booking.emailTwo ?? '',
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
              discountCents: booking.discountCents,
              customTotalCents: booking.customTotalCents,
              lockedTotal: booking.lockedTotal,
            }}
          />
          {!booking.venueName.trim() || !booking.venueStreet.trim() ? (
            <p className="rounded-lg border border-amber-300/30 bg-amber-300/10 px-3 py-2 text-sm text-amber-100 md:col-span-3">
              Add the venue name and street. The hold starts when the invoice is
              sent and both are filled in.
            </p>
          ) : null}
          <ActionButton
            className={`${deskGhost} w-fit`}
            checkForm
            busy="Saving…"
            done="Saved"
            surface={deskSurface}
            onRun={async (form: FormData): Promise<RunResult | undefined> => {
              const withStag = form.get('withStag') === 'on'
              const discount = readDiscount(form)
              if (!discount.ok) {
                setError(null)
                return { ok: false, message: discount.error }
              }
              const result = await save({
                data: {
                  id: booking.id,
                  partnerOne: String(form.get('partnerOne') ?? ''),
                  partnerTwo: String(form.get('partnerTwo') ?? ''),
                  email: String(form.get('email') ?? ''),
                  emailTwo: String(form.get('emailTwo') ?? ''),
                  phone: String(form.get('phone') ?? ''),
                  eventDate: String(form.get('eventDate') ?? ''),
                  stagDate: withStag
                    ? String(form.get('stagDate') ?? '')
                    : null,
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
                  discountCents: discount.cents,
                  customTotalCents: customCents(form),
                  lockedTotal: form.get('lockedTotal') === 'on',
                },
              })
              // The reason shows right under the button, not a generic retry.
              if (!result.ok) {
                setError(null)
                return { ok: false, message: result.error }
              }
              setError(null)
              setNotice('Saved.')
              await router.invalidate()
              return { ok: result.ok, message: 'Saved.' }
            }}
          >
            Save details
          </ActionButton>
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
          {booking.invoice && booking.invoice.status !== 'void' && canMail ? (
            <button
              type="button"
              className={deskGhost}
              onBlur={() => setConfirmMail(false)}
              onClick={() => {
                if (!confirmMail) {
                  setConfirmMail(true)
                  return
                }
                setConfirmMail(false)
                void mailInvoice({ data: { id: booking.id } })
                  .then(async (result) => {
                    if (!result.ok) {
                      setError(result.error)
                      return
                    }
                    setError(null)
                    setNotice(
                      result.delivered
                        ? result.markedSent
                          ? `The invoice email is on its way to ${booking.email}. The invoice is marked sent.`
                          : result.detail.startsWith('The invoice email went out')
                            ? result.detail
                            : `The invoice email is on its way to ${booking.email}.`
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
              {confirmMail ? `Tap again to email ${booking.email}` : 'Email the invoice'}
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
            onSubmit={(event) => event.preventDefault()}
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
            <ActionButton
              className={`mt-3 ${action === 'cancel' ? deskDanger : deskGhost}`}
              checkForm
              busy="Saving…"
              done="Saved"
              surface={deskSurface}
              onRun={updateStatus}
            >
              Update status
            </ActionButton>
          </form>
          <form
            className="rounded-xl border border-white/10 bg-ink-950 p-4"
            onSubmit={(event) => event.preventDefault()}
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
              <ActionButton
                className={deskPrimary}
                checkForm
                busy="Saving…"
                done="Saved"
                surface={deskSurface}
                onRun={(form) => savePayment(form, 'payment')}
              >
                Record payment
              </ActionButton>
              <ActionButton
                className={deskGhost}
                checkForm
                busy="Saving…"
                done="Saved"
                surface={deskSurface}
                onRun={(form) => savePayment(form, 'refund')}
              >
                Record refund
              </ActionButton>
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
        <div className="rounded-xl border border-white/10 bg-ink-950 p-4">
          <p className="font-semibold">Delete this booking</p>
          <p className="mt-1 text-sm text-white/65">
            The booking, invoice, and payments are removed. The date opens. An
            inquiry with the same names stays until you delete it on the leads
            page.
          </p>
          {confirmDelete ? (
            <div className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={deskDanger}
                onClick={() => {
                  void remove({ data: { id: booking.id } }).then(
                    async (result) => {
                      if (!result.ok) {
                        setError(result.error)
                        return
                      }
                      setError(null)
                      setNotice('Deleted. The date is open.')
                      await router.invalidate()
                    },
                  )
                }}
              >
                Delete this booking
              </button>
              <button
                type="button"
                className={deskGhost}
                onClick={() => setConfirmDelete(false)}
              >
                Keep it
              </button>
            </div>
          ) : (
            <button
              type="button"
              className={`mt-3 ${deskDanger}`}
              onClick={() => setConfirmDelete(true)}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </article>
  )
}

/**
 * Travel on a booking: the distance (auto or manual), the fee, the hotel
 * flag, an override for distance and fee, and Recalculate.
 */
function TravelPanel({
  booking,
}: {
  booking: {
    id: number
    packageId: string
    venueStreet: string
    travel: {
      km: number | null
      feeCents: number | null
      tier: string | null
      hotel: boolean
      source: string
      error: string
      stale: boolean
    }
    invoice: { receivedCents: number } | null
  }
}) {
  const recalc = useServerFn(recalcTravel)
  const saveManual = useServerFn(saveTravel)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const travel = booking.travel
  const paid = (booking.invoice?.receivedCents ?? 0) > 0
  const label = distanceLabel(travel.km, travel.source as TravelSource)
  const fee =
    travel.feeCents == null
      ? '—'
      : travel.feeCents === 0
        ? booking.packageId === 'ceremony'
          ? 'Included with The Aisle'
          : 'Included'
        : cad(travel.feeCents)
  return (
    <section className="rounded-xl border border-white/10 bg-white/5 p-4" aria-label="Travel">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{label}</p>
          <p className="text-sm text-white/65">{`Travel fee: ${fee ?? ''}${travel.source === 'manual' ? ' (manual)' : travel.source === 'auto' ? ' (auto)' : ''}`}
          </p>
          {travel.hotel ? (
            <p className="mt-1 text-sm font-semibold text-amber-700">
              Hotel required: over 200 km.
            </p>
          ) : null}
          {!booking.venueStreet.trim() ? (
            <p className="mt-1 text-sm text-white/65">
              Add the venue address to work out travel.
            </p>
          ) : null}
          {travel.source === 'failed' && travel.error ? (
            <p className="mt-1 text-xs text-white/65">{travel.error}</p>
          ) : null}
          {travel.source === '' && travel.error ? (
            <p className="mt-1 text-sm text-amber-700">{travel.error}</p>
          ) : null}
          {travel.stale ? (
            <p className="mt-1 text-sm text-amber-700">{`The venue address changed${paid ? ' and this invoice has a payment, so travel was kept' : ''}. Press Recalculate to update it.`}</p>
          ) : null}
        </div>
        <ActionButton
          className={deskGhost}
          busy="Working it out…"
          done="Updated"
          surface={deskSurface}
          onRun={async (): Promise<RunResult> => {
            const result = await recalc({ data: { id: booking.id } })
            if (!result.ok) return { ok: false, message: result.error }
            await router.invalidate()
            const next = result.booking.travel
            const message =
              next.source === 'failed'
                ? TRAVEL_FAILED_TEXT
                : next.km != null
                  ? `${next.km.toFixed(1)} km`
                  : next.error || 'Updated.'
            setNotice(message)
            return { ok: next.source !== 'failed', message }
          }}
        >
          Recalculate
        </ActionButton>
      </div>
      <details className="group mt-3">
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-hot [&::-webkit-details-marker]:hidden">
          {travel.source === 'manual' ? 'Change the manual distance or fee' : 'Enter distance or fee by hand'}
        </summary>
        <form
          className="mt-2 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
          onSubmit={(event) => event.preventDefault()}
        >
          <label className="field">
            Distance (km, one way)
            <input
              name="km"
              inputMode="decimal"
              defaultValue={travel.source === 'manual' && travel.km != null ? String(travel.km) : ''}
              placeholder={travel.km != null ? String(travel.km) : 'e.g. 82.4'}
            />
          </label>
          <label className="field">
            Travel fee ($)
            <input
              name="fee"
              inputMode="decimal"
              defaultValue={
                travel.source === 'manual' && travel.feeCents != null
                  ? (travel.feeCents / 100).toFixed(2)
                  : ''
              }
              placeholder="From the distance"
            />
          </label>
          <ActionButton
            className={deskPrimary}
            busy="Saving…"
            done="Saved"
            surface={deskSurface}
            onRun={async (form: FormData): Promise<RunResult> => {
              const result = await saveManual({
                data: {
                  id: booking.id,
                  km: String(form.get('km') ?? ''),
                  fee: String(form.get('fee') ?? ''),
                },
              })
              if (!result.ok) return { ok: false, message: result.error }
              await router.invalidate()
              const message =
                result.booking.travel.source === 'manual'
                  ? 'Saved. This sticks until you clear both boxes.'
                  : 'Back to automatic.'
              setNotice(message)
              return { ok: true, message }
            }}
          >
            Save
          </ActionButton>
          <p className="text-xs text-white/65 sm:col-span-3">
            A fee you enter wins; a distance alone picks the fee from the
            tiers. Clear both boxes and save to go back to automatic.
          </p>
        </form>
      </details>
      {notice ? (
        <p className="mt-2 text-sm text-white/85" role="status">
          {notice}
        </p>
      ) : null}
    </section>
  )
}

/** Any address: driving distance and travel fee. Saves nothing. */
function DistanceCheck() {
  const check = useServerFn(checkDistance)
  const [result, setResult] = useState<string | null>(null)
  return (
    <details className={`${deskCard} group`}>
      <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-display text-xl font-bold [&::-webkit-details-marker]:hidden">
        Check a distance
        <ChevronDown className="desk-motion h-5 w-5 text-white/40 group-open:rotate-180" aria-hidden="true" />
      </summary>
      <form className="mt-3 grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end" onSubmit={(event) => event.preventDefault()}>
        <label className="field">
          Venue address
          <input name="address" required placeholder="60 Ava Rd, Brantford, ON" />
        </label>
        <ActionButton
          className={deskPrimary}
          checkForm
          busy="Checking…"
          done="Checked"
          surface={deskSurface}
          onRun={async (form: FormData): Promise<RunResult> => {
            const reply = await check({ data: { address: String(form.get('address') ?? '') } })
            if (!reply.ok) {
              setResult(reply.error)
              return { ok: false, message: TRAVEL_FAILED_TEXT }
            }
            const fee = reply.feeCents === 0 ? 'included' : cad(reply.feeCents)
            const text = `${reply.km.toFixed(1)} km one way · travel ${fee}${reply.hotel ? ' · hotel required' : ''}`
            setResult(text)
            return { ok: true, message: text }
          }}
        >
          Check
        </ActionButton>
      </form>
      {result ? <p className="mt-2 text-sm text-white/85" role="status">{result}</p> : null}
    </details>
  )
}

function VenuePair({
  venues,
  chooseLabel,
  nameLabel,
  streetLabel,
  nameField,
  streetField,
  defaultName = '',
  defaultStreet = '',
  secondChooseLabel,
  secondNameLabel,
  secondStreetLabel,
  secondNameField,
  secondStreetField,
  defaultSecondName = '',
  defaultSecondStreet = '',
  span,
  labelClass,
  inputClass,
}: {
  venues: SavedVenue[]
  chooseLabel: string
  nameLabel: string
  streetLabel: string
  nameField: string
  streetField: string
  defaultName?: string
  defaultStreet?: string
  secondChooseLabel: string
  secondNameLabel: string
  secondStreetLabel: string
  secondNameField: string
  secondStreetField: string
  defaultSecondName?: string
  defaultSecondStreet?: string
  span: string
  labelClass: string
  inputClass?: string
}) {
  return (
    <>
      <VenueFields
        venues={venues}
        chooseLabel={chooseLabel}
        nameLabel={nameLabel}
        streetLabel={streetLabel}
        nameField={nameField}
        streetField={streetField}
        defaultName={defaultName}
        defaultStreet={defaultStreet}
        span={span}
        labelClass={labelClass}
        inputClass={inputClass}
      />
      <VenueFields
        venues={venues}
        chooseLabel={secondChooseLabel}
        nameLabel={secondNameLabel}
        streetLabel={secondStreetLabel}
        nameField={secondNameField}
        streetField={secondStreetField}
        defaultName={defaultSecondName}
        defaultStreet={defaultSecondStreet}
        span={span}
        labelClass={labelClass}
        inputClass={inputClass}
      />
    </>
  )
}

function VenueFields({
  venues,
  chooseLabel,
  nameLabel,
  streetLabel,
  nameField,
  streetField,
  defaultName,
  defaultStreet,
  span,
  labelClass,
  inputClass,
}: {
  venues: SavedVenue[]
  chooseLabel: string
  nameLabel: string
  streetLabel: string
  nameField: string
  streetField: string
  defaultName: string
  defaultStreet: string
  span: string
  labelClass: string
  inputClass?: string
}) {
  const [name, setName] = useState(defaultName)
  const [street, setStreet] = useState(defaultStreet)
  const picked = matchingVenue(venues, name)

  return (
    <>
      {venues.length > 0 ? (
        <label className={`${labelClass} ${span}`}>
          {chooseLabel}
          <select
            className={inputClass}
            value={picked ? String(picked.id) : ''}
            onChange={(event) => {
              const venue = venues.find(
                (item) => String(item.id) === event.target.value,
              )
              if (!venue) return
              setName(venue.name)
              setStreet(venue.street)
            }}
          >
            <option value="">Pick a saved venue</option>
            {venues.map((venue) => (
              <option key={venue.id} value={venue.id}>
                {venue.street ? `${venue.name} — ${venue.street}` : venue.name}
              </option>
            ))}
          </select>
        </label>
      ) : null}
      <label className={labelClass}>
        {nameLabel}
        <input
          name={nameField}
          maxLength={160}
          className={inputClass}
          value={name}
          onChange={(event) => {
            const next = event.target.value
            setName(next)
            const match = matchingVenue(venues, next)
            if (match) setStreet(match.street)
          }}
        />
      </label>
      <label className={labelClass}>
        {streetLabel}
        <input
          name={streetField}
          maxLength={160}
          className={inputClass}
          value={street}
          onChange={(event) => setStreet(event.target.value)}
        />
      </label>
    </>
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
  venues,
  defaults,
  columns = 2,
}: {
  packageId: string
  onPackage: (value: string) => void
  packages: { id: string; name: string }[]
  venues: SavedVenue[]
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
    discountCents: number
    customTotalCents: number
    lockedTotal: boolean
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
        <input name="email" type="email" defaultValue={defaults?.email} />
      </label>
      <label className="field">
        Second email (optional)
        <input name="emailTwo" type="email" defaultValue={defaults?.emailTwo} />
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
          <option value="custom">Custom event</option>
        </select>
      </label>
      {packageId === 'custom' ? (
        <label className="field">
          Custom price
          <input
            name="customTotal"
            inputMode="decimal"
            placeholder="Piper sets it, in dollars"
            defaultValue={
              defaults?.customTotalCents
                ? (defaults.customTotalCents / 100).toFixed(2)
                : ''
            }
          />
        </label>
      ) : null}
      <label
        className={`flex items-center gap-3 text-sm text-white/85 ${span}`}
      >
        <input
          name="lockedTotal"
          type="checkbox"
          defaultChecked={defaults?.lockedTotal}
        />
        Lock the agreed total. This booking is never repriced.
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
      {/* Travel is worked out from the venue address now; older typed
          kilometres ride along unchanged. */}
      <input type="hidden" name="kmOne" defaultValue={defaults?.kmOne} />
      <input type="hidden" name="kmTwo" defaultValue={defaults?.kmTwo} />
      <label className="field">
        Discount
        <input
          name="discount"
          inputMode="decimal"
          placeholder="0.00"
          defaultValue={
            defaults?.discountCents
              ? (defaults.discountCents / 100).toFixed(2)
              : ''
          }
        />
      </label>
      <VenuePair
        venues={venues}
        chooseLabel="Choose a venue"
        nameLabel="Venue name"
        streetLabel="Venue street"
        nameField="venueName"
        streetField="venueStreet"
        defaultName={defaults?.venueName}
        defaultStreet={defaults?.venueStreet}
        secondChooseLabel="Choose a second venue"
        secondNameLabel="Second venue name"
        secondStreetLabel="Second venue street"
        secondNameField="venueTwoName"
        secondStreetField="venueTwoStreet"
        defaultSecondName={defaults?.venueTwoName}
        defaultSecondStreet={defaults?.venueTwoStreet}
        span={span}
        labelClass="field"
      />
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

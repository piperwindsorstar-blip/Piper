import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { ArrowRight, Calendar, Check } from 'lucide-react'
import {
  externalCouple,
  externalKindLabel,
  externalVenues,
} from '../../lib/crm/external-dates.ts'
import { cad } from '../../lib/crm/money.ts'
import { longDate } from '../../lib/crm/dates.ts'
import { todayInToronto } from '../../lib/crm/date-request.ts'
import {
  attention,
  bookChartLabel,
  daysUntil,
  monthActivity,
  onTheBook,
  upcomingMonths,
} from '../../lib/desk-console.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { Chip, deskCard, statusTone } from '../../components/desk-ui.tsx'

const deskRoute = getRouteApi('/desk')

export const Route = createFileRoute('/desk/')({
  head: () => deskHead('Overview · DJ Piper P'),
  component: OverviewPage,
})

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date()),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function OverviewPage() {
  const desk = deskRoute.useLoaderData()
  const data = desk.overview
  const today = todayInToronto()
  const waiting = attention(desk.bookings, desk.leads, today)
  const booked = onTheBook(desk.bookings)
  const owed = booked.reduce(
    (sum, booking) =>
      sum + Math.max(0, booking.invoice?.balanceCents ?? booking.totalCents),
    0,
  )

  type Row = {
    key: string
    date: string
    title: string
    detail: string
    status: string
  }
  const coming: Row[] = [
    ...data.upcoming.map((booking) => ({
      key: `b-${booking.id}`,
      date: booking.eventDate,
      title: `${booking.partnerOne} and ${booking.partnerTwo}`,
      detail: booking.venueName || booking.packageName,
      status: booking.status,
    })),
    ...data.external.map((row) => ({
      key: `x-${row.id}`,
      date: row.eventDate,
      title: externalCouple(row)
        ? `${externalCouple(row)} · ${row.company}`
        : row.company,
      detail: [
        `${externalKindLabel(row.kind)} for another company`,
        ...externalVenues(row),
      ].join(' · '),
      status: 'booked',
    })),
  ]
    .filter((row) => row.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))

  return (
    <div className="grid gap-6">
      <div>
        <h1 className="font-display text-3xl font-bold tracking-tight md:text-4xl">
          {greeting()}, Piper.
        </h1>
        <p className="mt-1 text-sm text-[#5b5370]">
          {longDate(today)} ·{' '}
          {waiting.length === 0
            ? 'Nothing needs you right now.'
            : `${waiting.length} ${waiting.length === 1 ? 'thing needs' : 'things need'} you.`}
        </p>
      </div>

      <section className={deskCard} aria-labelledby="needs-you">
        <h2 id="needs-you" className="text-lg font-semibold">
          Needs you
        </h2>
        {waiting.length === 0 ? (
          <p className="mt-3 flex items-center gap-2 text-sm text-[#5b5370]">
            <Check className="h-5 w-5 text-emerald-600" aria-hidden="true" />
            All caught up. New inquiries and deposits due show up here.
          </p>
        ) : (
          <ul className="mt-2 divide-y divide-[#eee8f7]">
            {waiting.map((item) => (
              <li key={item.id}>
                <Link
                  to={item.to}
                  className="group flex min-h-14 items-center justify-between gap-3 py-3"
                >
                  <span className="min-w-0">
                    <span className="block font-medium group-hover:text-[#d1006b]">
                      {item.title}
                    </span>
                    <span className="block truncate text-sm text-[#5b5370]">
                      {item.detail}
                    </span>
                  </span>
                  <ArrowRight
                    className="h-4 w-4 shrink-0 text-[#5b5370] group-hover:text-[#d1006b]"
                    aria-hidden="true"
                  />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat to="/desk/bookings" label="Weddings on the book" value={String(booked.length + data.external.length)} />
        <Stat to="/desk/leads" label="Open inquiries" value={String(data.leads)} />
        <Stat to="/desk/invoices" label="Booked value" value={cad(data.totalCents)} />
        <Stat to="/desk/payments" label="Still to collect" value={cad(owed)} />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section className={deskCard} aria-labelledby="coming-up">
          <div className="flex items-center justify-between gap-3">
            <h2 id="coming-up" className="text-lg font-semibold">
              Coming up
            </h2>
            <Link
              to="/desk/bookings"
              className="inline-flex min-h-11 items-center gap-1 text-sm font-semibold text-[#d1006b] hover:underline"
            >
              All bookings
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
          </div>
          {coming.length === 0 ? (
            <p className="mt-3 text-sm text-[#5b5370]">
              No dates held or booked yet. Test samples stay off this list.
            </p>
          ) : (
            <ul className="mt-1 divide-y divide-[#eee8f7]">
              {coming.slice(0, 8).map((row) => {
                const days = daysUntil(today, row.date)
                return (
                  <li key={row.key} className="flex items-center gap-3 py-3">
                    <span className="grid w-12 shrink-0 place-items-center rounded-xl bg-[#f7f2fb] py-1.5 text-center leading-tight">
                      <span className="text-[11px] font-semibold text-[#d1006b] uppercase">
                        {new Date(`${row.date}T12:00:00Z`).toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' })}
                      </span>
                      <span className="text-lg font-bold">{Number(row.date.slice(8, 10))}</span>
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium">{row.title}</span>
                      <span className="block truncate text-sm text-[#5b5370]">
                        {days === 0 ? 'Today' : days === 1 ? 'Tomorrow' : `In ${days} days`}
                        {row.detail ? ` · ${row.detail}` : ''}
                      </span>
                    </span>
                    <Chip tone={statusTone(row.status)}>{row.status === 'hold' ? 'held' : row.status}</Chip>
                  </li>
                )
              })}
            </ul>
          )}
        </section>

        <BookChart desk={desk} today={today} />
      </div>
    </div>
  )
}

function BookChart({
  desk,
  today,
}: {
  desk: ReturnType<typeof deskRoute.useLoaderData>
  today: string
}) {
  const months = upcomingMonths(today)
  const rows = months.map((month) => ({
    month,
    counts: monthActivity(month.key, desk.bookings, desk.leads, desk.externalDates),
  }))
  const peak = Math.max(
    1,
    ...rows.map((row) => row.counts.booked + row.counts.held + row.counts.lead),
  )
  return (
    <section className={deskCard} aria-labelledby="next-months">
      <h2 id="next-months" className="flex items-center gap-2 text-lg font-semibold">
        <Calendar className="h-5 w-5 text-[#d1006b]" aria-hidden="true" />
        The next 24 months
      </h2>
      <div
        className="mt-4 flex h-28 items-end gap-1"
        role="img"
        aria-label={bookChartLabel(desk.bookings, desk.leads, desk.externalDates)}
      >
        {rows.map(({ month, counts }) => {
          const total = counts.booked + counts.held + counts.lead
          const label = `${month.name} ${month.year}: ${counts.booked} booked, ${counts.held} held, ${counts.lead} inquiries`
          const part = (n: number) => `${(n / peak) * 100}%`
          return (
            <Link
              key={month.key}
              to="/desk/bookings"
              title={label}
              aria-label={label}
              className="flex h-full min-w-0 flex-1 flex-col justify-end gap-px rounded-sm hover:bg-[#f7f2fb]"
            >
              {counts.lead > 0 ? (
                <span className="w-full rounded-t-sm border border-dashed border-[#a99cc4]" style={{ height: part(counts.lead) }} />
              ) : null}
              {counts.held > 0 ? (
                <span className="w-full bg-amber-300" style={{ height: part(counts.held) }} />
              ) : null}
              {counts.booked > 0 ? (
                <span className="w-full rounded-b-sm bg-[#ff007f]" style={{ height: part(counts.booked) }} />
              ) : null}
              {total === 0 ? <span className="h-1 w-full rounded-full bg-[#eee8f7]" /> : null}
            </Link>
          )
        })}
      </div>
      <div className="mt-1 flex gap-1" aria-hidden="true">
        {months.map((month, index) => (
          <span key={month.key} className="min-w-0 flex-1 text-center text-[10px] text-[#5b5370]">
            {index % 3 === 0 ? month.short : ''}
          </span>
        ))}
      </div>
      <p className="mt-3 flex flex-wrap gap-4 text-xs text-[#5b5370]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-[#ff007f]" aria-hidden="true" />
          Booked
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-amber-300" aria-hidden="true" />
          Held
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm border border-dashed border-[#a99cc4]" aria-hidden="true" />
          Inquiry
        </span>
      </p>
    </section>
  )
}

function Stat({
  to,
  label,
  value,
}: {
  to: '/desk/bookings' | '/desk/leads' | '/desk/invoices' | '/desk/payments'
  label: string
  value: string
}) {
  return (
    <Link
      to={to}
      className="group rounded-2xl border border-[#e3dcf2] bg-white p-4 shadow-[0_1px_2px_rgba(28,21,51,0.05)] transition hover:border-[#ff007f] desk-motion"
    >
      <p className="text-xs text-[#5b5370] group-hover:text-[#d1006b] sm:text-sm">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums sm:text-2xl md:text-3xl">{value}</p>
    </Link>
  )
}

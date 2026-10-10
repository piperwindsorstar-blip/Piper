import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { cad } from '../../lib/crm/money.ts'
import { longDate } from '../../lib/crm/dates.ts'
import { todayInToronto } from '../../lib/crm/date-request.ts'
import { getOverview } from '../../lib/crm/desk.functions.ts'
import { attention } from '../../lib/desk-console.ts'
import { deskHead } from '../../lib/desk-head.ts'
import {
  Chip,
  DeskTitle,
  deskCard,
  statusTone,
} from '../../components/desk-ui.tsx'

const deskRoute = getRouteApi('/desk')

export const Route = createFileRoute('/desk/')({
  head: () => deskHead('Overview · Piper DJing'),
  loader: () => getOverview(),
  component: OverviewPage,
})

function OverviewPage() {
  const data = Route.useLoaderData()
  const desk = deskRoute.useLoaderData()
  const waiting = attention(desk.bookings, desk.leads, todayInToronto())
  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Overview" title="Overview" />
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat
          to="/desk/bookings"
          label="On the book"
          value={String(data.bookings)}
        />
        <Stat to="/desk/leads" label="Leads" value={String(data.leads)} />
        <Stat
          to="/desk/invoices"
          label="Counted total"
          value={cad(data.totalCents)}
        />
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <section className={deskCard}>
          <h2 className="font-display text-xl font-bold">Held and booked</h2>
          <p className="mt-0.5 text-sm text-white/65">
            Samples stay off this list.
          </p>
          {data.upcoming.length === 0 ? (
            <p className="mt-4 text-sm text-white/65">No date is held yet.</p>
          ) : (
            <ul className="mt-2 divide-y divide-white/10">
              {data.upcoming.map((booking) => (
                <li
                  key={booking.id}
                  className="flex items-center justify-between gap-3 py-3"
                >
                  <div>
                    <p className="font-semibold">
                      {booking.partnerOne} and {booking.partnerTwo}
                    </p>
                    <p className="text-sm text-white/65">
                      {longDate(booking.eventDate)} · {booking.status}
                    </p>
                  </div>
                  <Chip tone={statusTone(booking.status)}>
                    {booking.status}
                  </Chip>
                </li>
              ))}
            </ul>
          )}
          <Link
            to="/desk/bookings"
            className="mt-3 inline-flex text-sm font-semibold text-hot hover:underline"
          >
            Open bookings
          </Link>
        </section>
        <section className={deskCard}>
          <h2 className="font-display text-xl font-bold">Next up</h2>
          {waiting.length > 0 ? (
            <ul className="mt-2 divide-y divide-white/10">
              {waiting.map((item) => (
                <li key={item.id}>
                  <Link to={item.to} className="block py-3">
                    <p className="font-semibold">{item.title}</p>
                    <p className="text-sm text-white/65">{item.detail}</p>
                  </Link>
                </li>
              ))}
            </ul>
          ) : null}
        </section>
      </div>
    </div>
  )
}

function Stat({
  to,
  label,
  value,
}: {
  to: '/desk/bookings' | '/desk/leads' | '/desk/invoices'
  label: string
  value: string
}) {
  return (
    <Link
      to={to}
      className="rounded-2xl border border-white/10 bg-white/[0.04] p-5 transition hover:border-neon/50 desk-motion"
    >
      <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/65">
        {label}
      </p>
      <p className="mt-3 font-display text-4xl font-extrabold tabular-nums">
        {value}
      </p>
    </Link>
  )
}

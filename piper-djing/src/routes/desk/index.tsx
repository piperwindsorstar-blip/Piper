import { Link, createFileRoute } from '@tanstack/react-router'
import { cad } from '../../lib/crm/money.ts'
import { longDate } from '../../lib/crm/dates.ts'
import { getOverview } from '../../lib/crm/desk.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/')({
  head: () => privateHead('Overview · Piper DJing'),
  loader: () => getOverview(),
  component: OverviewPage,
})

function OverviewPage() {
  const data = Route.useLoaderData()
  return (
    <div className="grid gap-8">
      <h1 className="font-display text-4xl tracking-tight">Overview</h1>
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="On the book" value={String(data.bookings)} />
        <Stat label="Leads" value={String(data.leads)} />
        <Stat label="Counted total" value={cad(data.totalCents)} />
      </div>
      <section>
        <h2 className="font-display text-2xl">Held and booked</h2>
        <p className="mt-2 text-sm text-muted">Samples stay off this list.</p>
        {data.upcoming.length === 0 ? (
          <p className="mt-4 text-ink-soft">No date is held yet.</p>
        ) : (
          <ul className="mt-4 grid gap-3">
            {data.upcoming.map((booking) => (
              <li key={booking.id} className="rounded-card border border-line bg-ivory px-5 py-4">
                <p className="font-display text-xl">
                  {booking.partnerOne} and {booking.partnerTwo}
                </p>
                <p className="mt-1 text-sm text-muted">
                  {longDate(booking.eventDate)} · {booking.status}
                </p>
              </li>
            ))}
          </ul>
        )}
        <Link to="/desk/bookings" className="mt-6 inline-flex text-sm text-ink">
          Open bookings
        </Link>
      </section>
    </div>
  )
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-card border border-line bg-ivory px-5 py-4">
      <p className="text-sm text-muted">{label}</p>
      <p className="mt-2 font-display text-3xl tracking-tight">{value}</p>
    </div>
  )
}

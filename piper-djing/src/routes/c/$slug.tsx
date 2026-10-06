import { createFileRoute, notFound } from '@tanstack/react-router'
import { SiteFooter, SiteHeader } from '../../components/site-frame.tsx'
import { longDate } from '../../lib/crm/dates.ts'
import { getCouple } from '../../lib/crm/desk.functions.ts'
import { cad } from '../../lib/crm/money.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/c/$slug')({
  head: () => privateHead('Your date · Piper DJing'),
  loader: async ({ params }) => {
    const booking = await getCouple({ data: { slug: params.slug } })
    if (!booking) throw notFound()
    return booking
  },
  component: CouplePage,
})

function CouplePage() {
  const booking = Route.useLoaderData()
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-5 py-16">
        <p className="text-sm uppercase tracking-wide text-muted">
          {booking.sample ? 'TEST' : statusLine(booking.status)}
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          {booking.partnerOne} and {booking.partnerTwo}
        </h1>
        <p className="mt-6 text-lg">{longDate(booking.eventDate)}</p>
        {booking.stagDate ? (
          <p className="mt-2 text-ink-soft">
            Stag and doe {longDate(booking.stagDate)}
            {booking.stagReleased ? ', released' : ''}
          </p>
        ) : null}
        <p className="mt-2 text-ink-soft">
          {booking.packageName}
          {booking.withStag ? ', with a stag and doe' : ''}
        </p>
        {booking.venueName ? <p className="mt-2 text-ink-soft">{booking.venueName}</p> : null}
        <dl className="mt-8 grid gap-2 text-sm">
          <Row label="Total" value={cad(booking.totalCents)} />
          <Row label="Deposit" value={cad(booking.depositCents)} />
          <Row label="Received" value={cad(booking.receivedCents)} />
          <Row label="Balance" value={cad(booking.balanceCents)} />
        </dl>
      </main>
      <SiteFooter />
    </div>
  )
}

function statusLine(status: string): string {
  if (status === 'booked') return 'Booked'
  if (status === 'hold') return 'Held'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'released') return 'Released'
  return 'Open'
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

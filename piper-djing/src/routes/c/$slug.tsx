import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { PlanningForm } from '../../components/planning-form.tsx'
import { SiteFooter, SiteHeader } from '../../components/site-frame.tsx'
import { longDate } from '../../lib/crm/dates.ts'
import { GOOGLE_REVIEW_URL } from '../../lib/crm/defaults.ts'
import {
  getCouple,
  saveCouplePlanningForm,
} from '../../lib/crm/desk.functions.ts'
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
  const { slug } = Route.useParams()
  const save = useServerFn(saveCouplePlanningForm)
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
        {booking.withStag ? (
          <p className="mt-2 text-ink-soft">{stagLine(booking)}</p>
        ) : null}
        <p className="mt-2 text-ink-soft">
          {booking.packageName}
          {booking.withStag ? ', with a stag and doe' : ''}
        </p>
        {booking.venueName ? (
          <p className="mt-2 text-ink-soft">Venue: {booking.venueName}</p>
        ) : null}
        {booking.venueTwoName ? (
          <p className="mt-2 text-ink-soft">
            Second venue: {booking.venueTwoName}
          </p>
        ) : null}
        {booking.status === 'hold' &&
        booking.holdStartedOn &&
        booking.holdLastDay ? (
          <p className="mt-2 text-ink-soft">
            Hold: {longDate(booking.holdStartedOn)} through{' '}
            {longDate(booking.holdLastDay)}
          </p>
        ) : null}
        {booking.invoiceStatus === 'void' ? (
          <p className="mt-6 text-sm">
            This invoice is void. The balance is zero.
          </p>
        ) : null}
        <dl className="mt-8 grid gap-2 text-sm">
          {booking.discountCents > 0 ? (
            <Row label="Discount" value={cad(booking.discountCents)} />
          ) : null}
          <Row label="Total" value={cad(booking.totalCents)} />
          <Row label="Deposit" value={cad(booking.depositCents)} />
          <Row label="Received" value={cad(booking.receivedCents)} />
          <Row label="Balance" value={cad(booking.balanceCents)} />
        </dl>
        {booking.invoiceSlug ? (
          <p className="mt-8 text-sm">
            Your invoice is {invoiceLine(booking.invoiceStatus)}.{' '}
            <Link
              to="/p/$slug"
              params={{ slug: booking.invoiceSlug }}
              className="inline-flex min-h-11 items-center text-ink"
            >
              Invoice
            </Link>
          </p>
        ) : null}
        {booking.status === 'booked' ? (
          <p className="mt-8 text-sm">
            <a
              href={GOOGLE_REVIEW_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 items-center underline underline-offset-4"
            >
              Leave a Google review
            </a>
          </p>
        ) : null}
        <PlanningForm
          initial={booking.planning}
          saved={booking.planningSaved}
          onSave={async (planning) => {
            const result = await save({ data: { slug, planning } })
            if (!result.ok) return result
            return { ok: true as const }
          }}
        />
      </main>
      <SiteFooter />
    </div>
  )
}

function statusLine(status: string): string {
  if (status === 'booked') return 'Booked'
  if (status === 'hold') return 'On hold'
  if (status === 'cancelled') return 'Cancelled'
  if (status === 'released') return 'Released'
  return 'Open'
}

function invoiceLine(status: string | null): string {
  if (status === 'sent') return 'sent'
  if (status === 'void') return 'void'
  return 'a draft'
}

function stagLine(booking: {
  stagDate: string | null
  stagReleased: boolean
}): string {
  if (booking.stagReleased) return 'The stag date is released.'
  if (!booking.stagDate) return 'Stag and doe: date still to set.'
  return `Stag and doe: ${longDate(booking.stagDate)}`
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2">
      <dt className="text-muted">{label}</dt>
      <dd>{value}</dd>
    </div>
  )
}

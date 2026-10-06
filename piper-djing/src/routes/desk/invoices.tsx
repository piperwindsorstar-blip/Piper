import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { longDate } from '../../lib/crm/dates.ts'
import { getInvoices, markSent, markVoid } from '../../lib/crm/desk.functions.ts'
import { cad } from '../../lib/crm/money.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/invoices')({
  head: () => privateHead('Invoices · Piper DJing'),
  loader: () => getInvoices(),
  component: InvoicesPage,
})

function InvoicesPage() {
  const bookings = Route.useLoaderData()
  const sent = useServerFn(markSent)
  const voided = useServerFn(markVoid)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-4xl tracking-tight">Invoices</h1>
      {notice ? <p className="text-sm text-ink-soft">{notice}</p> : null}
      {bookings.length === 0 ? <p>No invoices yet.</p> : null}
      {bookings.map((booking) => (
        <article key={booking.id} className="rounded-card border border-line bg-ivory px-5 py-5">
          <h2 className="font-display text-2xl">
            {booking.partnerOne} and {booking.partnerTwo}
            {booking.sample ? <span className="ml-3 text-sm text-danger">TEST</span> : null}
          </h2>
          <p className="mt-2 text-sm text-muted">{longDate(booking.eventDate)}</p>
          {booking.invoice ? (
            <p className="mt-3 text-sm">
              {booking.invoice.status} · {cad(booking.invoice.totalCents)} total · {cad(booking.invoice.depositCents)}{' '}
              deposit · {cad(booking.invoice.receivedCents)} received · {cad(booking.invoice.balanceCents)} balance
            </p>
          ) : (
            <p className="mt-3 text-sm">No invoice.</p>
          )}
          <div className="mt-4 flex flex-wrap gap-2">
            <button
              type="button"
              className="min-h-11 rounded-full bg-ink px-4 text-sm text-ivory"
              onClick={() => {
                void sent({ data: { id: booking.id } }).then(async (result) => {
                  setNotice(result.ok ? (result.newlyBooked ? 'Booked.' : 'Sent.') : result.error)
                  if (result.ok) await router.invalidate()
                })
              }}
            >
              Mark sent
            </button>
            <button
              type="button"
              className="min-h-11 rounded-full border border-line px-4 text-sm"
              onClick={() => {
                void voided({ data: { id: booking.id } }).then(async (result) => {
                  setNotice(result.ok ? 'Void. The balance is zero.' : result.error)
                  if (result.ok) await router.invalidate()
                })
              }}
            >
              Void
            </button>
          </div>
        </article>
      ))}
    </div>
  )
}

import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getPayments, recordPayment } from '../../lib/crm/desk.functions.ts'
import { cad, dollarsToCents } from '../../lib/crm/money.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/payments')({
  head: () => privateHead('Payments · Piper DJing'),
  loader: () => getPayments(),
  component: PaymentsPage,
})

function PaymentsPage() {
  const data = Route.useLoaderData()
  const pay = useServerFn(recordPayment)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-4xl tracking-tight">Payments</h1>
      {notice ? <p className="text-sm">{notice}</p> : null}
      <form
        className="grid gap-3 rounded-card border border-line bg-ivory px-5 py-5 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          const submitter = event.nativeEvent instanceof SubmitEvent ? event.nativeEvent.submitter : null
          const form = new FormData(event.currentTarget, submitter)
          const refund = form.get('kind') === 'refund'
          try {
            const cents = dollarsToCents(String(form.get('amount') ?? ''))
            void pay({
              data: {
                id: Number(form.get('bookingId')),
                cents: refund ? -cents : cents,
                note: String(form.get('note') ?? ''),
              },
            }).then(async (result) => {
              setNotice(
                result.ok
                  ? result.newlyBooked
                    ? 'The deposit cleared. The date is booked.'
                    : 'Recorded.'
                  : result.error,
              )
              if (result.ok) await router.invalidate()
            })
          } catch (error) {
            setNotice(error instanceof Error ? error.message : 'Enter an amount.')
          }
        }}
      >
        <label className="field sm:col-span-2">
          Booking
          <select name="bookingId" required defaultValue="">
            <option value="" disabled>
              Choose a booking
            </option>
            {data.bookings.map((booking) => (
              <option key={booking.id} value={booking.id}>
                {booking.partnerOne} and {booking.partnerTwo}
                {booking.sample ? ' TEST' : ''}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Amount
          <input name="amount" inputMode="decimal" required placeholder="500.00" />
        </label>
        <label className="field">
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
      <ul className="grid gap-3">
        {data.payments.map((payment) => (
          <li key={payment.id} className="rounded-2xl border border-line px-4 py-3 text-sm">
            {payment.names} · {cad(payment.cents)}
            {payment.note ? ` · ${payment.note}` : ''}
          </li>
        ))}
      </ul>
    </div>
  )
}

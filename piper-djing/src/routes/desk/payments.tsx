import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskDanger,
  deskGhost,
  deskPrimary,
} from '../../components/desk-ui.tsx'
import {
  deletePayment,
  editPayment,
  getPayments,
  recordPayment,
} from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { dollarsToCents } from '../../lib/crm/money.ts'

export const Route = createFileRoute('/desk/payments')({
  head: () => deskHead('Payments · Piper DJing'),
  loader: () => getPayments(),
  component: PaymentsPage,
})

function PaymentsPage() {
  const data = Route.useLoaderData()
  const pay = useServerFn(recordPayment)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Payments" title="Payments" />
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
      <form
        className={`${deskCard} grid gap-3 sm:grid-cols-2`}
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
            setNotice(
              error instanceof Error ? error.message : 'Enter an amount.',
            )
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
          <input
            name="amount"
            inputMode="decimal"
            required
            placeholder="500.00"
          />
        </label>
        <label className="field">
          Note
          <input name="note" />
        </label>
        <button name="kind" value="payment" className={deskPrimary}>
          Record payment
        </button>
        <button name="kind" value="refund" className={deskGhost}>
          Record refund
        </button>
      </form>
      <ul className="grid gap-3">
        {data.payments.map((payment) => (
          <PaymentCard key={payment.id} payment={payment} />
        ))}
      </ul>
    </div>
  )
}

function PaymentCard({
  payment,
}: {
  payment: { id: number; names: string; cents: number; note: string }
}) {
  const save = useServerFn(editPayment)
  const remove = useServerFn(deletePayment)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const refund = payment.cents < 0

  return (
    <li className="rounded-2xl border border-white/10 bg-ink-900 px-4 py-3">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          try {
            const cents = dollarsToCents(String(form.get('amount') ?? ''))
            const next = form.get('kind') === 'refund' ? -cents : cents
            void save({
              data: {
                id: payment.id,
                cents: next,
                note: String(form.get('note') ?? ''),
              },
            }).then(async (result) => {
              setNotice(
                result.ok ? 'Saved. A booked date stays booked.' : result.error,
              )
              if (result.ok) await router.invalidate()
            })
          } catch (error) {
            setNotice(
              error instanceof Error ? error.message : 'Enter an amount.',
            )
          }
        }}
      >
        <p className="font-semibold sm:col-span-2">{payment.names}</p>
        <label className="field">
          Amount
          <input
            name="amount"
            inputMode="decimal"
            required
            defaultValue={(Math.abs(payment.cents) / 100).toFixed(2)}
          />
        </label>
        <label className="field">
          Kind
          <select name="kind" defaultValue={refund ? 'refund' : 'payment'}>
            <option value="payment">Payment</option>
            <option value="refund">Refund</option>
          </select>
        </label>
        <label className="field sm:col-span-2">
          Note
          <input name="note" defaultValue={payment.note} />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <button type="submit" className={deskPrimary}>
            Save
          </button>
          <button
            type="button"
            className={deskDanger}
            onClick={() => {
              void remove({ data: { id: payment.id } }).then(async (result) => {
                setNotice(
                  result.ok
                    ? 'Removed. A booked date stays booked.'
                    : result.error,
                )
                if (result.ok) await router.invalidate()
              })
            }}
          >
            Delete
          </button>
        </div>
      </form>
      {notice ? <p className="mt-3 text-sm text-white/85">{notice}</p> : null}
    </li>
  )
}

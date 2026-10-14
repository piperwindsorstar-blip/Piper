import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskDanger,
  deskGhost,
  deskPrimary,
  deskSurface,
} from '../../components/desk-ui.tsx'
import {
  deletePayment,
  editPayment,
  getPayments,
  recordPayment,
} from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { cad, dollarsToCents } from '../../lib/crm/money.ts'
import { stripeFromNote } from '../../lib/crm/card-pay.ts'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'

export const Route = createFileRoute('/desk/payments')({
  head: () => deskHead('Payments · DJ Piper P'),
  loader: () => getPayments(),
  component: PaymentsPage,
})

function PaymentsPage() {
  const data = Route.useLoaderData()
  const pay = useServerFn(recordPayment)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  async function record(
    form: FormData,
    kind: 'payment' | 'refund',
  ): Promise<{ ok: boolean; message: string }> {
    const refund = kind === 'refund'
    try {
      const cents = dollarsToCents(String(form.get('amount') ?? ''))
      const result = await pay({
        data: {
          id: Number(form.get('bookingId')),
          cents: refund ? -cents : cents,
          note: String(form.get('note') ?? ''),
          paidOn: String(form.get('paidOn') ?? ''),
          method: String(form.get('method') ?? ''),
        },
      })
      const message = result.ok
        ? result.newlyBooked
          ? 'The deposit cleared. The date is booked.'
          : refund
            ? 'Refund recorded.'
            : 'Payment recorded.'
        : result.error
      setNotice(message)
      if (result.ok) await router.invalidate()
      return { ok: result.ok, message }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Enter an amount.'
      setNotice(message)
      return { ok: false, message }
    }
  }

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Payments" title="Payments" />
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
      <form
        className={`${deskCard} grid gap-3 sm:grid-cols-2`}
        onSubmit={(event) => event.preventDefault()}
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
          Payment date
          <input name="paidOn" type="date" />
        </label>
        <label className="field">
          Method
          <select name="method" defaultValue="">
            <option value="">Not set</option>
            <option value="e-transfer">e-transfer</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </label>
        <label className="field sm:col-span-2">
          Note
          <input name="note" />
        </label>
        <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
          <ActionButton
            className={deskPrimary}
            checkForm
            busy="Saving…"
            done="Saved"
            surface={deskSurface}
            onRun={(form) => record(form, 'payment')}
          >
            Record payment
          </ActionButton>
          <ActionButton
            className={deskGhost}
            checkForm
            busy="Saving…"
            done="Saved"
            surface={deskSurface}
            onRun={(form) => record(form, 'refund')}
          >
            Record refund
          </ActionButton>
        </div>
      </form>
      <ul className="grid gap-3">
        {data.payments.map((payment) => (
          <PaymentCard key={payment.id} payment={payment} />
        ))}
      </ul>
      {data.rsvp.length > 0 ? (
        <section aria-labelledby="rsvp-purchases" className="grid gap-3">
          <h2 id="rsvp-purchases" className="font-display text-xl font-bold">
            RSVP pages bought by card
          </h2>
          <ul className="grid gap-3">
            {data.rsvp.map((row) => (
              <RsvpPurchaseRow key={row.sessionId} row={row} />
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

const RSVP_OUTCOME: Record<string, string> = {
  created: 'New site made',
  attached: 'Paid their existing site (same email)',
  'needs-check': 'Needs a look: that name belongs to another email',
}

function RsvpPurchaseRow({
  row,
}: {
  row: {
    sessionId: string
    slug: string
    couple: string
    email: string
    priceKind: string
    baseCents: number
    hstCents: number
    paymentId: string
    live: boolean
    outcome: string
    paidOn: string
  }
}) {
  const stripe = row.paymentId.startsWith('pi_')
    ? `https://dashboard.stripe.com/${row.live ? '' : 'test/'}payments/${row.paymentId}`
    : ''
  return (
    <li className="rounded-2xl border border-white/10 bg-ink-900 px-4 py-3 text-sm">
      <p className="flex flex-wrap items-center gap-2 font-semibold">
        {row.couple}
        <span className="rounded-full bg-[#E0007A] px-2.5 py-0.5 text-xs font-semibold text-white">
          RSVP
        </span>
        <span className="rounded-full bg-[#635BFF] px-2.5 py-0.5 text-xs font-semibold text-white">
          Stripe{row.live ? '' : ' · test'}
        </span>
        {stripe ? (
          <a
            href={stripe}
            target="_blank"
            rel="noreferrer"
            className="inline-flex min-h-11 items-center font-normal text-white/75 underline underline-offset-4 hover:text-white"
          >
            View in Stripe
          </a>
        ) : null}
      </p>
      <p className="mt-1 text-white/85">
        {cad(row.baseCents)} + {cad(row.hstCents)} HST ={' '}
        {cad(row.baseCents + row.hstCents)} ·{' '}
        {row.priceKind === 'piper' ? 'Piper couple price' : 'Standalone price'}
        {row.paidOn ? ` · ${row.paidOn}` : ''}
      </p>
      <p className="text-white/65">
        {row.email} · /rsvp/{row.slug} · {RSVP_OUTCOME[row.outcome] ?? row.outcome}
      </p>
    </li>
  )
}

function PaymentCard({
  payment,
}: {
  payment: {
    id: number
    names: string
    cents: number
    note: string
    paidOn: string
    method: string
    hstCents: number
  }
}) {
  const save = useServerFn(editPayment)
  const remove = useServerFn(deletePayment)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const refund = payment.cents < 0
  const stripe = stripeFromNote(payment.note)

  return (
    <li className="rounded-2xl border border-white/10 bg-ink-900 px-4 py-3">
      <form
        className="grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <p className="flex flex-wrap items-center gap-2 font-semibold sm:col-span-2">
          {payment.names}
          {stripe ? (
            <>
              <span className="rounded-full bg-[#635BFF] px-2.5 py-0.5 text-xs font-semibold text-white">
                Stripe{stripe.live ? '' : ' · test'}
              </span>
              <a
                href={stripe.dashboardUrl}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center text-sm font-normal text-white/75 underline underline-offset-4 hover:text-white"
              >
                View in Stripe
              </a>
            </>
          ) : null}
        </p>
        {payment.hstCents > 0 ? (
          <p className="text-sm text-white/75 sm:col-span-2">
            Card HST {cad(payment.hstCents)} (13% of this payment) · charged{' '}
            {cad(Math.abs(payment.cents) + payment.hstCents)}. HST is on top
            and does not count toward the balance.
          </p>
        ) : null}
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
        <label className="field">
          Payment date
          <input name="paidOn" type="date" defaultValue={payment.paidOn} />
        </label>
        <label className="field">
          Method
          <select name="method" defaultValue={payment.method}>
            <option value="">Not set</option>
            <option value="e-transfer">e-transfer</option>
            <option value="cash">Cash</option>
            <option value="card">Card</option>
          </select>
        </label>
        <label className="field sm:col-span-2">
          Note
          <input name="note" defaultValue={payment.note} />
        </label>
        <div className="flex flex-wrap gap-3 sm:col-span-2">
          <ActionButton
            className={deskPrimary}
            checkForm
            busy="Saving…"
            done="Saved"
            surface={deskSurface}
            onRun={async (form: FormData): Promise<RunResult | undefined> => {
              try {
                const cents = dollarsToCents(String(form.get('amount') ?? ''))
                const next = form.get('kind') === 'refund' ? -cents : cents
                const result = await save({
                  data: {
                    id: payment.id,
                    cents: next,
                    note: String(form.get('note') ?? ''),
                    paidOn: String(form.get('paidOn') ?? ''),
                    method: String(form.get('method') ?? ''),
                  },
                })
                setNotice(
                  result.ok
                    ? 'Saved. A booked date stays booked.'
                    : result.error,
                )
                if (result.ok) await router.invalidate()
                return {
                  ok: result.ok,
                  message: result.ok ? 'Saved.' : result.error,
                }
              } catch (error) {
                const message =
                  error instanceof Error ? error.message : 'Enter an amount.'
                setNotice(message)
                return { ok: false, message }
              }
            }}
          >
            Save
          </ActionButton>
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

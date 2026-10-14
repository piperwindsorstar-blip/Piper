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

  const [tab, setTab] = useState<Tab>('all')
  const received = data.payments
    .filter((payment) => payment.cents > 0)
    .reduce((sum, payment) => sum + payment.cents, 0)
  const refunded = data.payments
    .filter((payment) => payment.cents < 0)
    .reduce((sum, payment) => sum - payment.cents, 0)
  const hst =
    data.payments.reduce((sum, payment) => sum + (payment.cents > 0 ? payment.hstCents : 0), 0) +
    data.rsvp.reduce((sum, row) => sum + row.hstCents, 0)
  const counts: Record<Tab, number> = {
    all: data.payments.length,
    card: data.payments.filter((payment) => payment.method === 'card' && payment.cents > 0).length,
    'e-transfer': data.payments.filter((payment) => payment.method === 'e-transfer' && payment.cents > 0).length,
    cash: data.payments.filter((payment) => payment.method === 'cash' && payment.cents > 0).length,
    refunds: data.payments.filter((payment) => payment.cents < 0).length,
    rsvp: data.rsvp.length,
  }
  const shown = data.payments.filter((payment) => {
    if (tab === 'all') return true
    if (tab === 'refunds') return payment.cents < 0
    if (tab === 'rsvp') return false
    return payment.method === tab && payment.cents > 0
  })

  return (
    <div className="grid gap-6">
      <DeskTitle kicker="Payments" title="Payments">
        Money in and out, newest first. Tap a payment to change or remove it.
        Card HST sits on top and never counts toward a balance.
      </DeskTitle>

      <div className="grid gap-3 sm:grid-cols-3">
        <Total label="Received" value={cad(received)} />
        <Total label="Refunded" value={cad(refunded)} />
        <Total label="Card HST collected (on top)" value={cad(hst)} />
      </div>

      <details className={`${deskCard} group`}>
        <summary className="flex min-h-11 cursor-pointer list-none items-center justify-between gap-3 font-semibold [&::-webkit-details-marker]:hidden">
          Record a payment or refund
          <span className="text-sm font-normal text-[#5b5370] group-open:hidden">Open</span>
          <span className="hidden text-sm font-normal text-[#5b5370] group-open:inline">Close</span>
        </summary>
          <form
            className="mt-4 grid gap-3 sm:grid-cols-2"
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
      </details>
      {notice ? <p className="text-sm text-white/85" role="status">{notice}</p> : null}

      <section aria-labelledby="history" className="grid gap-3">
        <h2 id="history" className="text-lg font-semibold">
          History
        </h2>
        <div className="-mx-1 flex gap-2 overflow-x-auto px-1 pb-1 no-scrollbar" role="tablist" aria-label="Filter payments">
          {TABS.map(([id, label]) =>
            id !== 'all' && counts[id] === 0 ? null : (
              <button
                key={id}
                type="button"
                role="tab"
                aria-selected={tab === id}
                onClick={() => setTab(id)}
                className={`inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full border px-4 text-sm font-semibold transition ${
                  tab === id
                    ? 'border-[#1c1533] bg-[#1c1533] !text-white'
                    : 'border-[#e3dcf2] bg-white text-[#5b5370] hover:border-[#ff007f]'
                }`}
              >
                {label}
                <span className={tab === id ? 'text-[#cfc6e3]' : 'text-[#9a91ad]'}>{counts[id]}</span>
              </button>
            ),
          )}
        </div>

        {tab === 'rsvp' ? (
          <ul className="overflow-hidden rounded-2xl border border-[#e3dcf2] bg-white">
            {data.rsvp.map((row) => (
              <RsvpPurchaseRow key={row.sessionId} row={row} />
            ))}
          </ul>
        ) : shown.length === 0 ? (
          <p className="text-sm text-[#5b5370]">No payments here yet.</p>
        ) : (
          byMonth<(typeof data.payments)[number]>(shown).map(([month, rows]) => (
            <div key={month}>
              <h3 className="mb-1.5 px-1 text-xs font-semibold tracking-wider text-[#5b5370] uppercase">
                {month}
              </h3>
              <ul className="overflow-hidden rounded-2xl border border-[#e3dcf2] bg-white">
                {rows.map((payment) => (
                  <PaymentCard key={payment.id} payment={payment} />
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  )
}

type Tab = 'all' | 'card' | 'e-transfer' | 'cash' | 'refunds' | 'rsvp'

const TABS: [Tab, string][] = [
  ['all', 'All'],
  ['card', 'Card'],
  ['e-transfer', 'E-transfer'],
  ['cash', 'Cash'],
  ['refunds', 'Refunds'],
  ['rsvp', 'RSVP pages'],
]

/** Payments grouped under "October 2026", newest month first. */
function byMonth<T extends { paidOn: string; id: number }>(rows: T[]): [string, T[]][] {
  const groups = new Map<string, T[]>()
  const sorted = [...rows].sort(
    (a, b) => (b.paidOn || '').localeCompare(a.paidOn || '') || b.id - a.id,
  )
  for (const row of sorted) {
    const label = /^\d{4}-\d{2}/.test(row.paidOn)
      ? new Date(`${row.paidOn.slice(0, 7)}-15T12:00:00Z`).toLocaleDateString('en-CA', {
          month: 'long',
          year: 'numeric',
          timeZone: 'UTC',
        })
      : 'No date'
    groups.set(label, [...(groups.get(label) ?? []), row])
  }
  return [...groups.entries()]
}

function shortDay(iso: string): string {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return ''
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

const METHOD: Record<string, string> = {
  card: 'Card',
  'e-transfer': 'E-transfer',
  cash: 'Cash',
}

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-[#e3dcf2] bg-white p-4">
      <p className="text-sm text-[#5b5370]">{label}</p>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  )
}

const RSVP_OUTCOME: Record<string, string> = {
  created: 'New site made',
  attached: 'Paid their existing site (same email)',
  'needs-check': 'Needs a look: that name belongs to another email',
}

function StripeTag({ live, href }: { live: boolean; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => event.stopPropagation()}
      className="rounded-full bg-[#635BFF] px-2 py-0.5 text-[11px] font-semibold !text-white hover:brightness-110"
      title="View in Stripe"
    >
      Stripe{live ? '' : ' · test'} ↗
    </a>
  )
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
    <li className="border-b border-[#eee8f7] px-4 py-3 last:border-b-0">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex flex-wrap items-center gap-1.5 font-medium">
            <span className="truncate">{row.couple}</span>
            <span className="rounded-full bg-pink-50 px-2 py-0.5 text-[11px] font-semibold text-pink-700">
              RSVP
            </span>
            {stripe ? <StripeTag live={row.live} href={stripe} /> : null}
          </p>
          <p className="mt-0.5 text-xs text-[#5b5370]">
            {shortDay(row.paidOn)} · {row.priceKind === 'piper' ? 'Piper couple price' : 'Standalone'} ·{' '}
            {RSVP_OUTCOME[row.outcome] ?? row.outcome}
          </p>
          <p className="text-xs text-[#5b5370]">
            {row.email} · /rsvp/{row.slug}
          </p>
        </div>
        <div className="shrink-0 text-right">
          <p className="font-semibold tabular-nums">{cad(row.baseCents)}</p>
          <p className="text-xs text-[#5b5370] tabular-nums">+ {cad(row.hstCents)} HST</p>
        </div>
      </div>
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
  const [confirming, setConfirming] = useState(false)
  const refund = payment.cents < 0
  const stripe = stripeFromNote(payment.note)
  const note = stripe ? '' : payment.note

  return (
    <li className="border-b border-[#eee8f7] last:border-b-0">
      <details className="group">
        <summary className="flex min-h-14 cursor-pointer list-none items-center gap-3 px-4 py-3 hover:bg-[#faf8fd] [&::-webkit-details-marker]:hidden">
          <span className="w-12 shrink-0 text-xs font-semibold text-[#5b5370]">
            {shortDay(payment.paidOn) || '—'}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex flex-wrap items-center gap-1.5">
              <span className="truncate font-medium">{payment.names}</span>
              {refund ? (
                <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                  Refund
                </span>
              ) : null}
              {stripe ? <StripeTag live={stripe.live} href={stripe.dashboardUrl} /> : null}
            </span>
            <span className="block truncate text-xs text-[#5b5370]">
              {METHOD[payment.method] ?? 'Method not set'}
              {note ? ` · ${note}` : ''}
            </span>
          </span>
          <span className="shrink-0 text-right">
            <span className={`block font-semibold tabular-nums ${refund ? 'text-rose-700' : ''}`}>
              {refund ? '−' : ''}
              {cad(Math.abs(payment.cents))}
            </span>
            {payment.hstCents > 0 ? (
              <span className="block text-xs text-[#5b5370] tabular-nums">
                + {cad(payment.hstCents)} HST
              </span>
            ) : null}
          </span>
        </summary>
        <form
          className="grid gap-3 border-t border-[#eee8f7] bg-[#faf8fd] px-4 py-4 sm:grid-cols-2"
          onSubmit={(event) => event.preventDefault()}
        >
          {payment.hstCents > 0 ? (
            <p className="text-sm text-[#5b5370] sm:col-span-2">
              Card HST {cad(payment.hstCents)} (13% of this payment) · charged{' '}
              {cad(Math.abs(payment.cents) + payment.hstCents)} in total. HST
              is on top and does not count toward the balance.
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
          <div className="flex flex-wrap items-center gap-3 sm:col-span-2">
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
                  setNotice(result.ok ? 'Saved. A booked date stays booked.' : result.error)
                  if (result.ok) await router.invalidate()
                  return { ok: result.ok, message: result.ok ? 'Saved.' : result.error }
                } catch (error) {
                  const message = error instanceof Error ? error.message : 'Enter an amount.'
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
                if (!confirming) {
                  setConfirming(true)
                  return
                }
                setConfirming(false)
                void remove({ data: { id: payment.id } }).then(async (result) => {
                  setNotice(result.ok ? 'Removed. A booked date stays booked.' : result.error)
                  if (result.ok) await router.invalidate()
                })
              }}
              onBlur={() => setConfirming(false)}
            >
              {confirming ? 'Tap again to delete' : 'Delete'}
            </button>
          </div>
          {notice ? (
            <p className="text-sm text-[#1c1533] sm:col-span-2" role="status">
              {notice}
            </p>
          ) : null}
        </form>
      </details>
    </li>
  )
}

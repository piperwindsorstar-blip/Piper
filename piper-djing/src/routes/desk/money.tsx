import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useRef, useState } from 'react'
import {
  Bar,
  Chip,
  DeskTitle,
  MoneyBar,
  deskCard,
  deskDanger,
  deskDark,
  deskGhost,
  deskH2,
  deskPrimary,
  deskSurface,
  invoiceTone,
} from '../../components/desk-ui.tsx'
import { invoiceControls } from '../../lib/crm/booking-rules.ts'
import { longDate } from '../../lib/crm/dates.ts'
import { todayInToronto } from '../../lib/crm/date-request.ts'
import {
  deletePayment,
  editPayment,
  getPayments,
  markSent,
  markVoid,
  recordPayment,
  saveBalanceRemindersDesk,
  sendInvoiceMail,
} from '../../lib/crm/desk.functions.ts'
import type { BalanceRow } from '../../lib/crm/balance-nudges.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { hasCoupleAddress } from '../../lib/crm/mail-copy.ts'
import { cad, dollarsToCents } from '../../lib/crm/money.ts'
import { moneySummary } from '../../lib/crm/money-summary.ts'
import { stripeFromNote } from '../../lib/crm/card-pay.ts'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'

type MoneyTab = 'owes' | 'paid' | 'invoices' | 'rsvp'

export const Route = createFileRoute('/desk/money')({
  head: () => deskHead('Money · DJ Piper P'),
  validateSearch: (search: Record<string, unknown>): { tab?: MoneyTab } => {
    const tab = search.tab
    return tab === 'owes' || tab === 'paid' || tab === 'invoices' || tab === 'rsvp'
      ? { tab }
      : {}
  },
  loader: () => getPayments(),
  component: MoneyPage,
})

function dollars(cents: number): string {
  return cad(cents).replace(/\.00$/, '')
}

function MoneyPage() {
  const data = Route.useLoaderData()
  const search = Route.useSearch()
  const pay = useServerFn(recordPayment)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const [tab, setTab] = useState<MoneyTab>(search.tab ?? 'owes')
  const [formOpen, setFormOpen] = useState(false)
  const [chosen, setChosen] = useState('')
  const [amount, setAmount] = useState('')
  const formRef = useRef<HTMLFormElement>(null)
  const today = todayInToronto()

  const summary = moneySummary(data.bookings, data.payments, data.rsvp)
  const { totals, whoOwes } = summary
  const noEmail = whoOwes.filter((row) => !row.hasEmail).length
  const payable = data.bookings.filter(
    (booking) => booking.invoice && booking.invoice.status !== 'void',
  )
  const invoices = data.bookings.filter((booking) => booking.invoice)
  const collectedPct = totals.bookedCents > 0 ? (totals.collectedCents / totals.bookedCents) * 100 : 0

  function startPayment(bookingId: number, leftCents: number) {
    setChosen(String(bookingId))
    setAmount((leftCents / 100).toFixed(2))
    setFormOpen(true)
    requestAnimationFrame(() => {
      formRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      formRef.current?.querySelector<HTMLInputElement>('input[name="amount"]')?.focus()
    })
  }

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
      if (result.ok) {
        setAmount('')
        await router.invalidate()
      }
      return { ok: result.ok, message }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Enter an amount.'
      setNotice(message)
      return { ok: false, message }
    }
  }

  const tabs: [MoneyTab, string, number][] = [
    ['owes', 'Who owes', whoOwes.length],
    ['paid', 'Payments in', data.payments.length],
    ['invoices', 'Invoices', invoices.length],
    ['rsvp', 'RSVP pages', data.rsvp.length],
  ]

  return (
    <div className="grid gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <DeskTitle kicker="Your book" title="Money">
          Who owes what, and every payment in. Invoices and payments live on
          this one page.
        </DeskTitle>
        <button
          type="button"
          className={`${deskPrimary} lg:hidden`}
          aria-expanded={formOpen}
          onClick={() => setFormOpen((open) => !open)}
        >
          Record a payment
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <section
          aria-labelledby="still-to-collect"
          className="col-span-2 grid gap-3 rounded-[20px] bg-[#1c1533] p-6 text-[#fff] shadow-[0_18px_40px_-24px_rgba(28,21,51,0.6)] lg:col-span-1"
        >
          <p id="still-to-collect" className="text-xs font-bold tracking-[0.16em] text-[#ff8cc6] uppercase">
            Still to collect
          </p>
          <p className="font-display text-5xl leading-none font-extrabold tracking-[-0.03em] tabular-nums md:text-6xl">
            {dollars(totals.stillToCollectCents)}
          </p>
          <Bar
            value={collectedPct}
            label={`${cad(totals.collectedCents)} of ${cad(totals.bookedCents)} collected`}
            color="bg-[#7ee2b0]"
            track="bg-[#3a2f5c]"
          />
          <p className="text-sm text-[#d9d0ea]">
            {dollars(totals.collectedCents)} collected of {dollars(totals.bookedCents)} booked,
            across {totals.weddings} {totals.weddings === 1 ? 'wedding' : 'weddings'}. Pynx
            dates are paid by Pynx and are not counted.
          </p>
        </section>
        <SmallTotal label="Refunded" value={dollars(totals.refundedCents)} note={totals.refundedCents === 0 ? 'Nothing sent back' : 'Sent back to couples'} />
        <SmallTotal label="Card HST" value={dollars(totals.cardHstCents)} note="On top, never part of a balance" />
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_23rem]">
        <div className="grid min-w-0 gap-4">
          <div
            role="tablist"
            aria-label="Money"
            className="no-scrollbar flex w-fit max-w-full gap-1 overflow-x-auto rounded-xl bg-[#efe9fb] p-1"
          >
            {tabs.map(([id, label, count]) =>
              id === 'rsvp' && count === 0 ? null : (
                <button
                  key={id}
                  type="button"
                  role="tab"
                  aria-selected={tab === id}
                  onClick={() => setTab(id)}
                  className={`inline-flex min-h-11 shrink-0 items-center gap-2 rounded-lg px-4 text-[15px] transition ${
                    tab === id
                      ? 'bg-white font-bold text-[#1c1533] shadow-[0_1px_2px_rgba(28,21,51,0.14)]'
                      : 'font-semibold text-[#4b3f72] hover:text-[#1c1533]'
                  }`}
                >
                  {label}
                  <span
                    className={`rounded-full px-2 text-xs font-bold ${
                      tab === id ? 'bg-[#ff007f] text-[#1c1533]' : 'bg-white text-[#4b3f72]'
                    }`}
                  >
                    {count}
                  </span>
                </button>
              ),
            )}
          </div>

          {tab === 'owes' ? (
            <div className="grid gap-3">
              <BalanceReminders on={data.reminders.on} />
              {noEmail > 0 ? (
                <div className="rounded-2xl border border-dashed border-[#f3b6d3] bg-[#fff5fa] p-4">
                  <p className="font-semibold text-[#a3004f]">
                    {noEmail === whoOwes.length
                      ? 'None of these couples has an email yet.'
                      : `${noEmail} of these couples ${noEmail === 1 ? 'has' : 'have'} no email yet.`}
                  </p>
                  <p className="mt-1 text-sm text-[#4a4262]">
                    Invoices and card links can only go out by email once you add one on their
                    booking.
                  </p>
                </div>
              ) : null}
              {whoOwes.length === 0 ? (
                <p className={`${deskCard} text-[#5b5370]`}>
                  Nobody owes anything right now. Every held or booked couple is paid up.
                </p>
              ) : (
                whoOwes.map((row) => {
                  const booking = data.bookings.find((item) => item.id === row.bookingId)
                  return (
                    <OwingCard
                      key={row.bookingId}
                      row={row}
                      reminder={
                        data.reminders.on
                          ? data.reminders.rows.find((item) => item.id === row.bookingId)
                          : undefined
                      }
                      sample={booking?.sample ?? false}
                      onRecord={() => startPayment(row.bookingId, row.leftCents)}
                    />
                  )
                })
              )}
            </div>
          ) : null}

          {tab === 'paid' ? (
            data.payments.length === 0 ? (
              <p className="text-sm text-[#5b5370]">No payments yet.</p>
            ) : (
              <div className="grid gap-4">
                {summary.paymentsIn.map((month) => (
                  <section
                    key={month.month}
                    className="overflow-hidden rounded-[20px] border border-[#e6def4] bg-white"
                  >
                    <h2 className="bg-[#faf8fe] px-5 py-3 text-xs font-bold tracking-[0.14em] text-[#6b5fa0] uppercase">
                      {monthName(month.month)} · {dollars(month.netCents)}
                    </h2>
                    <ul>
                      {month.payments.map((payment) => (
                        <PaymentCard key={payment.id} payment={payment} />
                      ))}
                    </ul>
                  </section>
                ))}
              </div>
            )
          ) : null}

          {tab === 'invoices' ? (
            invoices.length === 0 ? (
              <p className="text-sm text-[#5b5370]">No invoices yet.</p>
            ) : (
              <ul className="grid gap-3">
                {invoices.map((booking) => (
                  <InvoiceCard key={booking.id} booking={booking} />
                ))}
              </ul>
            )
          ) : null}

          {tab === 'rsvp' ? (
            <ul className="overflow-hidden rounded-[20px] border border-[#e6def4] bg-white">
              {data.rsvp.map((row) => (
                <RsvpPurchaseRow key={row.sessionId} row={row} />
              ))}
            </ul>
          ) : null}
        </div>

        <form
          ref={formRef}
          aria-labelledby="record-payment"
          className={`${deskCard} ${formOpen ? 'grid' : 'hidden'} scroll-mt-20 gap-4 lg:sticky lg:top-8 lg:grid`}
          onSubmit={(event) => event.preventDefault()}
        >
          <h2 id="record-payment" className={deskH2}>
            Record a payment
          </h2>
          <label className="field">
            Couple
            <select
              name="bookingId"
              required
              value={chosen}
              onChange={(event) => setChosen(event.target.value)}
            >
              <option value="" disabled>
                Choose a couple
              </option>
              {payable.map((booking) => (
                <option key={booking.id} value={booking.id}>
                  {booking.partnerOne} & {booking.partnerTwo}
                  {booking.invoice && booking.invoice.balanceCents > 0
                    ? ` · ${dollars(booking.invoice.balanceCents)} left`
                    : ' · paid up'}
                  {booking.sample ? ' · TEST' : ''}
                </option>
              ))}
            </select>
          </label>
          <div className="grid grid-cols-2 gap-3">
            <label className="field">
              Amount
              <input
                name="amount"
                inputMode="decimal"
                required
                placeholder="500.00"
                value={amount}
                onChange={(event) => setAmount(event.target.value)}
              />
            </label>
            <label className="field">
              Paid on
              <input name="paidOn" type="date" defaultValue={today} />
            </label>
          </div>
          <fieldset className="grid gap-2">
            <legend className="mb-2 text-sm font-semibold">How they paid</legend>
            <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-1.5">
              {(
                [
                  ['e-transfer', 'E-transfer'],
                  ['cash', 'Cash'],
                  ['card', 'Card'],
                ] as const
              ).map(([value, label]) => (
                <label
                  key={value}
                  className="flex min-h-11 cursor-pointer items-center justify-center gap-1.5 rounded-lg border border-[#d6cce8] px-1.5 text-[13px] font-semibold whitespace-nowrap has-[:checked]:border-2 has-[:checked]:border-[#1c1533]"
                >
                  <input type="radio" name="method" value={value} defaultChecked={value === 'e-transfer'} />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
          <label className="field">
            Note
            <input name="note" placeholder="Balance, deposit…" />
          </label>
          <div className="grid gap-2">
            <ActionButton
              className={`${deskPrimary} w-full`}
              checkForm
              busy="Saving…"
              done="Saved"
              surface={deskSurface}
              onRun={(form) => record(form, 'payment')}
            >
              Save payment
            </ActionButton>
            <ActionButton
              className={`${deskGhost} w-full`}
              checkForm
              busy="Saving…"
              done="Saved"
              surface={deskSurface}
              onRun={(form) => record(form, 'refund')}
            >
              Record it as a refund
            </ActionButton>
          </div>
          {notice ? (
            <p className="text-sm text-[#1c1533]" role="status">
              {notice}
            </p>
          ) : null}
          <p className="text-sm text-[#5b5370]">
            Card payments record themselves when Stripe confirms them.
          </p>
        </form>
      </div>
    </div>
  )
}

function SmallTotal({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="grid min-w-0 content-start gap-1 rounded-[20px] border border-[#e6def4] bg-white p-4 sm:p-5">
      <p className="text-xs font-bold tracking-[0.14em] text-[#6b5fa0] uppercase">{label}</p>
      <p className="font-display text-2xl font-extrabold tabular-nums sm:text-3xl">{value}</p>
      <p className="text-sm text-[#5b5370]">{note}</p>
    </div>
  )
}

function monthName(month: string): string {
  if (!/^\d{4}-\d{2}$/.test(month)) return 'No date'
  return new Date(`${month}-15T12:00:00Z`).toLocaleDateString('en-CA', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  })
}

function BalanceReminders({ on }: { on: boolean }) {
  const save = useServerFn(saveBalanceRemindersDesk)
  const router = useRouter()
  return (
    <section className={`${deskCard} flex flex-wrap items-center justify-between gap-3`} aria-labelledby="balance-reminders">
      <div className="min-w-0 flex-[1_1_20rem]">
        <h2 id="balance-reminders" className="font-semibold text-[#1c1533]">
          Balance reminders {on ? 'are on' : 'are off'}
        </h2>
        <p className="mt-1 text-sm text-[#5b5370]">
          {on
            ? 'Booked couples who still owe get a friendly email with their invoice link about a month before the wedding and again in the last week. Each goes once, and nothing goes once they have paid in full.'
            : 'No balance reminders go out. You can still send an invoice by hand.'}
        </p>
      </div>
      <ActionButton
        className={on ? deskGhost : deskDark}
        busy={on ? 'Turning off…' : 'Turning on…'}
        done={on ? 'Off' : 'On'}
        surface={deskSurface}
        onRun={async (): Promise<RunResult> => {
          const result = await save({ data: { on: !on } })
          if (result.ok) await router.invalidate()
          return result.ok
            ? { ok: true, message: result.on ? 'Balance reminders are on.' : 'Balance reminders are off.' }
            : { ok: false, message: result.error }
        }}
      >
        {on ? 'Turn off' : 'Turn on'}
      </ActionButton>
    </section>
  )
}

function reminderText(row: BalanceRow): string {
  const last = row.last
    ? ` Last sent: ${row.last.step.toLowerCase()}, ${shortDay(row.last.at.slice(0, 10))}${row.last.delivered ? '' : ' (did not send)'}.`
    : ''
  if (row.block === 'More than a month to go') {
    const day = new Date(`${row.eventDate}T12:00:00Z`)
    day.setUTCDate(day.getUTCDate() - 30)
    return `First balance reminder around ${shortDay(day.toISOString().slice(0, 10))}.${last}`
  }
  if (row.block === 'No email on file') return `A balance reminder is due, but there is no email to send it to.${last}`
  if (row.block) return `${row.block}.${last}`
  return `Reminder window: ${row.due.toLowerCase()}.${last}`
}

function OwingCard({
  row,
  reminder,
  sample,
  onRecord,
}: {
  row: ReturnType<typeof moneySummary>['whoOwes'][number]
  reminder?: BalanceRow
  sample: boolean
  onRecord: () => void
}) {
  const [copied, setCopied] = useState(false)
  const payLink = row.invoiceSlug ? `/p/${row.invoiceSlug}` : ''
  const paidPct = row.totalCents > 0 ? (row.paidCents / row.totalCents) * 100 : 0
  return (
    <article className={`${deskCard} grid gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <Link
            to="/desk/bookings"
            search={{ couple: row.bookingId }}
            className="text-lg font-bold text-[#1c1533] hover:text-[#d1006b]"
          >
            {row.names.replace(' and ', ' & ')}
          </Link>
          {sample ? <span className="ml-2 align-middle"><Chip tone="red">Test</Chip></span> : null}
          <p className="text-sm text-[#5b5370]">
            Wedding {longDate(row.eventDate)}
            {row.invoiceStatus ? ` · Invoice ${row.invoiceStatus}` : ''}
          </p>
        </div>
        <div className="text-right">
          <p className="font-display text-3xl leading-none font-extrabold text-[#d1006b] tabular-nums">
            {dollars(row.leftCents)}
          </p>
          <p className="mt-1 text-xs text-[#5b5370]">left of {dollars(row.totalCents)}</p>
        </div>
      </div>
      <Bar value={paidPct} label={`${cad(row.paidCents)} of ${cad(row.totalCents)} paid`} />
      {reminder ? (
        <p className={`text-sm ${reminder.block === 'No email on file' ? 'font-semibold text-[#a3004f]' : 'text-[#5b5370]'}`}>
          {reminderText(reminder)}
        </p>
      ) : null}
      <div className="flex flex-wrap items-center gap-2">
        <button type="button" className={deskDark} onClick={onRecord}>
          Record payment
        </button>
        {payLink ? (
          <button
            type="button"
            className={deskGhost}
            onClick={() => {
              void navigator.clipboard
                ?.writeText(`${window.location.origin}${payLink}`)
                .then(() => {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2000)
                })
            }}
          >
            {copied ? 'Pay link copied' : 'Copy pay link'}
          </button>
        ) : null}
        {row.invoiceSlug ? (
          <Link
            to="/p/$slug"
            params={{ slug: row.invoiceSlug }}
            className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-[#d1006b] hover:underline"
          >
            Invoice page
          </Link>
        ) : null}
        {!row.hasEmail ? (
          <span className="ml-auto rounded-md border border-dashed border-[#f3b6d3] bg-[#fff5fa] px-2 py-1 text-xs font-semibold text-[#a3004f]">
            No email on file
          </span>
        ) : null}
      </div>
    </article>
  )
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
    <li className="border-t border-[#f0ebf8]">
      <details className="group">
        <summary className="flex min-h-16 cursor-pointer list-none items-center gap-3 px-5 py-3 hover:bg-[#faf8fd] [&::-webkit-details-marker]:hidden">
          <span className="w-10 shrink-0 text-center leading-tight">
            <span className="block text-[10px] font-bold tracking-[0.12em] text-[#d1006b] uppercase">
              {shortDay(payment.paidOn).split(' ')[0] || '—'}
            </span>
            <span className="block font-display text-xl font-extrabold">
              {shortDay(payment.paidOn).split(' ')[1] ?? ''}
            </span>
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
            <span className={`block font-bold tabular-nums ${refund ? 'text-rose-700' : 'text-[#0b5e41]'}`}>
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
function InvoiceCard({
  booking,
}: {
  booking: {
    id: number
    partnerOne: string
    partnerTwo: string
    email: string
    eventDate: string
    sample: boolean
    invoice: {
      slug: string
      status: string
      totalCents: number
      depositCents: number
      receivedCents: number
      balanceCents: number
    } | null
  }
}) {
  const sent = useServerFn(markSent)
  const voided = useServerFn(markVoid)
  const mailInvoice = useServerFn(sendInvoiceMail)
  const router = useRouter()
  const [notice, setNotice] = useState<{
    text: string
    error: boolean
  } | null>(null)
  const [pending, setPending] = useState(false)
  const [confirmVoid, setConfirmVoid] = useState(false)
  const controls = invoiceControls(booking.invoice?.status ?? null)
  const canMail = hasCoupleAddress(booking.email)

  async function run(
    action: () => Promise<
      | {
          ok: true
          newlyBooked?: boolean
          delivered?: boolean
          detail?: string
        }
      | { ok: false; error: string }
    >,
    done: (result: {
      ok: true
      newlyBooked?: boolean
      delivered?: boolean
      detail?: string
    }) => string,
  ) {
    setPending(true)
    try {
      const result = await action()
      setNotice(
        result.ok
          ? { text: done(result), error: false }
          : { text: result.error, error: true },
      )
      if (result.ok) await router.invalidate()
    } catch (error) {
      setNotice({
        text: error instanceof Error ? error.message : 'That did not save.',
        error: true,
      })
    } finally {
      setPending(false)
    }
  }

  return (
    <li className={deskCard}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="flex flex-wrap items-center gap-2 text-lg font-semibold">
            {booking.partnerOne} and {booking.partnerTwo}
            {booking.sample ? (
              <span className="rounded-full bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
                TEST
              </span>
            ) : null}
          </h2>
          <p className="mt-1 text-sm text-white/65">
            {longDate(booking.eventDate)}
          </p>
          {booking.invoice ? (
            <MoneyBar
              totalCents={booking.invoice.totalCents}
              depositCents={booking.invoice.depositCents}
              receivedCents={booking.invoice.receivedCents}
              discountCents={0}
            />
          ) : (
            <p className="mt-1 text-sm text-white/65">No invoice.</p>
          )}
        </div>
        {booking.invoice ? (
          <Chip tone={invoiceTone(booking.invoice.status)}>
            {booking.invoice.status}
          </Chip>
        ) : null}
      </div>
      {booking.invoice ? (
        <p className="mt-3">
          <Link
            to="/p/$slug"
            params={{ slug: booking.invoice.slug }}
            className="text-sm font-semibold text-hot hover:underline"
          >
            Invoice page
          </Link>
        </p>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-2">
        {controls.send ? (
          <button
            type="button"
            disabled={pending}
            className={deskPrimary}
            onClick={() => {
              void run(
                () => sent({ data: { id: booking.id } }),
                (result) => (result.newlyBooked ? 'Booked.' : 'Sent.'),
              )
            }}
          >
            Mark sent
          </button>
        ) : null}
        {controls.canVoid ? (
          <button
            type="button"
            disabled={pending}
            className={deskDanger}
            onBlur={() => setConfirmVoid(false)}
            onClick={() => {
              if (!confirmVoid) {
                setConfirmVoid(true)
                return
              }
              setConfirmVoid(false)
              void run(
                () => voided({ data: { id: booking.id } }),
                () => 'Void. The balance is zero.',
              )
            }}
          >
            {confirmVoid ? 'Tap again to void' : 'Void'}
          </button>
        ) : null}
        {booking.invoice && canMail ? (
          <button
            type="button"
            disabled={pending}
            className={deskGhost}
            onClick={() => {
              void run(
                () => mailInvoice({ data: { id: booking.id } }),
                (result) =>
                  result.delivered
                    ? `The invoice email is on its way to ${booking.email}.`
                    : (result.detail ?? 'That did not save.'),
              )
            }}
          >
            Email the invoice
          </button>
        ) : null}
      </div>
      {controls.blocked ? (
        <p className="mt-3 text-sm text-white/85">{controls.blocked}</p>
      ) : null}
      {booking.invoice && !canMail ? (
        <p className="mt-3 text-sm text-rose-300">
          This booking has no email address.
        </p>
      ) : null}
      {notice ? (
        <p
          role="status"
          className={`mt-3 text-sm ${notice.error ? 'text-rose-300' : 'text-white/85'}`}
        >
          {notice.text}
        </p>
      ) : null}
    </li>
  )
}

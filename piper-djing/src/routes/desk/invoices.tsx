import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  Chip,
  DeskTitle,
  MoneyBar,
  deskCard,
  deskDanger,
  deskGhost,
  deskPrimary,
  invoiceTone,
} from '../../components/desk-ui.tsx'
import { invoiceControls } from '../../lib/crm/booking-rules.ts'
import { longDate } from '../../lib/crm/dates.ts'
import {
  getInvoices,
  markSent,
  markVoid,
  sendInvoiceMail,
} from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { hasCoupleAddress } from '../../lib/crm/mail-copy.ts'
import { cad } from '../../lib/crm/money.ts'

export const Route = createFileRoute('/desk/invoices')({
  head: () => deskHead('Invoices · DJ Piper P'),
  loader: () => getInvoices(),
  component: InvoicesPage,
})

type InvoiceTab = 'all' | 'draft' | 'owing' | 'paid' | 'void'

const INVOICE_TABS: [InvoiceTab, string][] = [
  ['all', 'All'],
  ['draft', 'Drafts'],
  ['owing', 'Money owing'],
  ['paid', 'Paid in full'],
  ['void', 'Void'],
]

function InvoicesPage() {
  const bookings = Route.useLoaderData()
  const [tab, setTab] = useState<InvoiceTab>('all')
  const kind = (booking: (typeof bookings)[number]): InvoiceTab | null => {
    const invoice = booking.invoice
    if (!invoice) return null
    if (invoice.status === 'void') return 'void'
    if (invoice.status === 'draft') return 'draft'
    return invoice.balanceCents > 0 ? 'owing' : 'paid'
  }
  const count = (id: InvoiceTab) =>
    id === 'all'
      ? bookings.length
      : bookings.filter((booking) => kind(booking) === id).length
  const owed = bookings
    .filter((booking) => !booking.sample && kind(booking) === 'owing')
    .reduce((sum, booking) => sum + (booking.invoice?.balanceCents ?? 0), 0)
  const shown = bookings.filter((booking) => tab === 'all' || kind(booking) === tab)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Invoices" title="Invoices">
        Send, email or void each couple's invoice. Still owed on sent
        invoices: <strong className="text-[#1c1533]">{cad(owed)}</strong>
      </DeskTitle>
      <div
        role="tablist"
        aria-label="Filter invoices"
        className="no-scrollbar -mx-1 flex gap-2 overflow-x-auto px-1 pb-1"
      >
        {INVOICE_TABS.map(([id, label]) =>
          id !== 'all' && count(id) === 0 ? null : (
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
              <span className={tab === id ? 'text-[#cfc6e3]' : 'text-[#9a91ad]'}>
                {count(id)}
              </span>
            </button>
          ),
        )}
      </div>
      {shown.length === 0 ? (
        <p className="text-sm text-white/65">
          {bookings.length === 0 ? 'No invoices yet.' : 'No invoices here.'}
        </p>
      ) : null}
      <ul className="grid gap-3">
        {shown.map((booking) => (
          <InvoiceCard key={booking.id} booking={booking} />
        ))}
      </ul>
    </div>
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

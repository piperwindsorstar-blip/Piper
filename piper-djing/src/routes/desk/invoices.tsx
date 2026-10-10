import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  Chip,
  DeskTitle,
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
  head: () => deskHead('Invoices · Piper DJing'),
  loader: () => getInvoices(),
  component: InvoicesPage,
})

function InvoicesPage() {
  const bookings = Route.useLoaderData()

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Invoices" title="Invoices" />
      {bookings.length === 0 ? (
        <p className="text-sm text-white/65">No invoices yet.</p>
      ) : null}
      <ul className="grid gap-3">
        {bookings.map((booking) => (
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
    <li className="rounded-2xl border border-white/10 bg-ink-900 p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="font-display text-xl font-bold">
            {booking.partnerOne} and {booking.partnerTwo}
            {booking.sample ? (
              <span className="ml-3 text-sm text-rose-300">TEST</span>
            ) : null}
          </h2>
          <p className="mt-1 text-sm text-white/65">
            {longDate(booking.eventDate)}
          </p>
          {booking.invoice ? (
            <p className="mt-1 text-sm text-white/85 tabular-nums">
              {booking.invoice.status} · {cad(booking.invoice.totalCents)} total
              · {cad(booking.invoice.depositCents)} deposit ·{' '}
              {cad(booking.invoice.receivedCents)} received ·{' '}
              {cad(booking.invoice.balanceCents)} balance
            </p>
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
            onClick={() => {
              void run(
                () => voided({ data: { id: booking.id } }),
                () => 'Void. The balance is zero.',
              )
            }}
          >
            Void
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

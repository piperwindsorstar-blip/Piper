import { createFileRoute, useRouter } from '@tanstack/react-router'
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
import { longDate } from '../../lib/crm/dates.ts'
import {
  getInvoices,
  markSent,
  markVoid,
  sendInvoiceMail,
} from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { cad } from '../../lib/crm/money.ts'

export const Route = createFileRoute('/desk/invoices')({
  head: () => deskHead('Invoices · Piper DJing'),
  loader: () => getInvoices(),
  component: InvoicesPage,
})

function InvoicesPage() {
  const bookings = Route.useLoaderData()
  const sent = useServerFn(markSent)
  const voided = useServerFn(markVoid)
  const mailInvoice = useServerFn(sendInvoiceMail)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Invoices" title="Invoices" />
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
      {bookings.length === 0 ? (
        <p className="text-sm text-white/65">No invoices yet.</p>
      ) : null}
      <ul className="grid gap-3">
        {bookings.map((booking) => (
          <li
            key={booking.id}
            className="rounded-2xl border border-white/10 bg-ink-900 p-5"
          >
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
                    {booking.invoice.status} · {cad(booking.invoice.totalCents)}{' '}
                    total · {cad(booking.invoice.depositCents)} deposit ·{' '}
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
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                type="button"
                className={deskPrimary}
                onClick={() => {
                  void sent({ data: { id: booking.id } }).then(
                    async (result) => {
                      setNotice(
                        result.ok
                          ? result.newlyBooked
                            ? 'Booked.'
                            : 'Sent.'
                          : result.error,
                      )
                      if (result.ok) await router.invalidate()
                    },
                  )
                }}
              >
                Mark sent
              </button>
              <button
                type="button"
                className={deskDanger}
                onClick={() => {
                  void voided({ data: { id: booking.id } }).then(
                    async (result) => {
                      setNotice(
                        result.ok ? 'Void. The balance is zero.' : result.error,
                      )
                      if (result.ok) await router.invalidate()
                    },
                  )
                }}
              >
                Void
              </button>
              {booking.invoice ? (
                <button
                  type="button"
                  className={deskGhost}
                  onClick={() => {
                    void mailInvoice({ data: { id: booking.id } }).then(
                      async (result) => {
                        setNotice(
                          result.ok
                            ? result.delivered
                              ? `The invoice email is on its way to ${booking.email}.`
                              : result.detail
                            : result.error,
                        )
                        if (result.ok) await router.invalidate()
                      },
                    )
                  }}
                >
                  Email the invoice
                </button>
              ) : null}
            </div>
          </li>
        ))}
      </ul>
    </div>
  )
}

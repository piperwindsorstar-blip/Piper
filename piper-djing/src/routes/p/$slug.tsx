import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'
import { HST_RATE_PERCENT } from '../../lib/crm/card-pay.ts'
import type { CardQuote } from '../../lib/crm/card-pay.ts'
import { SiteFooter, SiteHeader } from '../../components/site-frame.tsx'
import { longDate } from '../../lib/crm/dates.ts'
import {
  getInvoicePage,
  startCardPayment,
} from '../../lib/crm/desk.functions.ts'
import { cad } from '../../lib/crm/money.ts'
import { PUBLIC_EMAIL } from '../../lib/crm/defaults.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/p/$slug')({
  head: () => privateHead('Invoice · DJ Piper P'),
  validateSearch: (search: Record<string, unknown>): { paid?: 1 } =>
    search.paid === 1 || search.paid === '1' ? { paid: 1 } : {},
  loader: async ({ params }) => {
    const invoice = await getInvoicePage({ data: { slug: params.slug } })
    if (!invoice) throw notFound()
    return invoice
  },
  component: InvoicePage,
})

function InvoicePage() {
  const invoice = Route.useLoaderData()
  const { paid } = Route.useSearch()
  const { slug } = Route.useParams()
  const voided = invoice.status === 'void'
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-5 py-16">
        <img
          src="/photos/logo-inverted.png"
          alt="DJ Piper P"
          className="h-20 w-auto"
        />
        <p className="mt-6 text-sm tracking-wide text-muted uppercase">
          {invoice.sample ? 'TEST invoice' : 'Invoice'} · {invoice.status}
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          {invoice.partnerOne} and {invoice.partnerTwo}
        </h1>
        <p className="mt-4 text-ink-soft">{longDate(invoice.eventDate)}</p>
        {voided ? (
          <p className="mt-6 text-sm">
            This invoice is void. The balance is zero.
          </p>
        ) : null}

        <section className="mt-8" aria-labelledby="line-items">
          <h2 id="line-items" className="font-display text-2xl tracking-tight">
            What this covers
          </h2>
          <dl className="mt-4 grid gap-2 text-sm">
            <Row label={`Package · ${invoice.packageName}`} value="" />
            {invoice.venueName ? (
              <Row label={`Venue · ${invoice.venueName}`} value="" />
            ) : null}
            {invoice.venueTwoName ? (
              <Row
                label={`Second ceremony venue · ${invoice.venueTwoName}`}
                value=""
              />
            ) : null}
            {invoice.uplights > 0 ? (
              <Row label={`Wired uplights · ${invoice.uplights}`} value="" />
            ) : null}
          </dl>
        </section>

        <dl className="mt-8 grid gap-2 text-sm">
          {invoice.discountCents > 0 ? (
            <Row label="Discount" value={cad(invoice.discountCents)} />
          ) : null}
          <Row label="Total" value={cad(invoice.totalCents)} />
          <Row label="Deposit" value={cad(invoice.depositCents)} />
          {invoice.depositDue ? (
            <Row
              label="Deposit due"
              value={longDate(invoice.depositDue)}
            />
          ) : null}
          <Row label="Received" value={cad(invoice.receivedCents)} />
          <Row label="Balance" value={cad(invoice.balanceCents)} />
        </dl>

        {paid ? (
          <p
            role="status"
            className="mt-8 rounded-2xl border border-line px-5 py-4 text-sm leading-relaxed"
          >
            Thank you. Your card payment went through. It shows on this invoice
            within a minute or two, and a confirmation email is on its way.
          </p>
        ) : null}

        <section className="mt-8" aria-labelledby="how-to-pay">
          <h2 id="how-to-pay" className="font-display text-2xl tracking-tight">
            How to pay
          </h2>
          <p className="mt-3 text-sm leading-relaxed">
            You can pay by e-transfer to{' '}
            <a
              href={`mailto:${PUBLIC_EMAIL}`}
              className="text-ink underline underline-offset-4"
            >
              {PUBLIC_EMAIL}
            </a>
            , or by cash. E-transfer and cash have no HST.
            {invoice.card && !paid
              ? ` Card adds ${HST_RATE_PERCENT}% HST, which is charged once, with the balance, never on the deposit.`
              : ''}
          </p>
          {invoice.card && !paid ? (
            <PayByCard slug={slug} quote={invoice.card} />
          ) : null}
        </section>

        <section
          className="mt-10 rounded-2xl border border-line px-5 py-6"
          aria-labelledby="agree"
        >
          <h2 id="agree" className="font-display text-2xl tracking-tight">
            I agree
          </h2>
          <p className="mt-3 text-sm leading-relaxed text-ink-soft">
            Sending the deposit, or paying a Ceremony only invoice in full, is
            agreement to the terms. A signature is extra proof and does not hold
            the date by itself. Read the{' '}
            <Link to="/terms" className="text-ink underline underline-offset-4">
              full terms
            </Link>
            .
          </p>
          <div className="mt-6 grid gap-6 text-sm text-muted">
            <span className="border-b border-line pb-1">Signature</span>
            <span className="border-b border-line pb-1">Printed name</span>
            <span className="border-b border-line pb-1">Date</span>
          </div>
        </section>

        <p className="mt-8 text-sm">
          <Link
            to="/c/$slug"
            params={{ slug: invoice.bookingSlug }}
            className="inline-flex min-h-11 items-center text-ink"
          >
            Your page
          </Link>
        </p>
      </main>
      <SiteFooter />
    </div>
  )
}

function PayByCard({ slug, quote }: { slug: string; quote: CardQuote }) {
  const start = useServerFn(startCardPayment)
  return (
    <div className="mt-5 rounded-2xl border border-line px-5 py-5">
      <h3 className="font-display text-xl tracking-tight">Pay by card</h3>
      <dl className="mt-3 grid gap-1 text-sm">
        <Row label={quote.label} value={cad(quote.baseCents)} />
        {quote.hstCents > 0 ? (
          <Row
            label={`HST ${HST_RATE_PERCENT}% on the ${cad(quote.hstOnCents)} booking total`}
            value={cad(quote.hstCents)}
          />
        ) : (
          <Row label="HST" value="None on the deposit" />
        )}
        <div className="flex justify-between gap-4 border-t border-ink py-2 font-semibold">
          <dt>Card total</dt>
          <dd className="tabular-nums">{cad(quote.chargeCents)}</dd>
        </div>
      </dl>
      <ActionButton
        className="mt-4 inline-flex min-h-11 items-center justify-center rounded-full bg-violet px-6 py-3 font-semibold text-white hover:brightness-110"
        busy="Opening secure checkout…"
        done="Opening"
        surface="light"
        onRun={async (): Promise<RunResult> => {
          const result = await start({ data: { slug } })
          if (!result.ok) return { ok: false, message: result.error }
          window.location.assign(result.url)
          return { ok: true }
        }}
      >
        Pay {cad(quote.chargeCents)} by card
      </ActionButton>
      <p className="mt-3 text-xs leading-relaxed text-muted">
        You pay on Stripe's secure page, in Canadian dollars. Your card details
        never touch this site.
      </p>
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

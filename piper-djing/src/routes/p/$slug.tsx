import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { SiteFooter, SiteHeader } from '../../components/site-frame.tsx'
import { longDate } from '../../lib/crm/dates.ts'
import { getInvoicePage } from '../../lib/crm/desk.functions.ts'
import { cad } from '../../lib/crm/money.ts'
import { PUBLIC_EMAIL } from '../../lib/crm/defaults.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/p/$slug')({
  head: () => privateHead('Invoice · DJ Piper P'),
  loader: async ({ params }) => {
    const invoice = await getInvoicePage({ data: { slug: params.slug } })
    if (!invoice) throw notFound()
    return invoice
  },
  component: InvoicePage,
})

function InvoicePage() {
  const invoice = Route.useLoaderData()
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

        <p className="mt-8 text-sm leading-relaxed">
          You can pay by e-transfer to{' '}
          <a
            href={`mailto:${PUBLIC_EMAIL}`}
            className="text-ink underline underline-offset-4"
          >
            {PUBLIC_EMAIL}
          </a>
          , by cash, or by card. Card adds 13% HST, which is charged on the
          balance, not the deposit.
        </p>

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

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-4 border-t border-line py-2">
      <dt className="text-muted">{label}</dt>
      <dd className="tabular-nums">{value}</dd>
    </div>
  )
}

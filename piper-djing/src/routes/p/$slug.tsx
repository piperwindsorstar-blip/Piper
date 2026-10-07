import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { SiteFooter, SiteHeader } from '../../components/site-frame.tsx'
import { longDate } from '../../lib/crm/dates.ts'
import { getInvoicePage } from '../../lib/crm/desk.functions.ts'
import { cad } from '../../lib/crm/money.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/p/$slug')({
  head: () => privateHead('Invoice · Piper DJing'),
  loader: async ({ params }) => {
    const invoice = await getInvoicePage({ data: { slug: params.slug } })
    if (!invoice) throw notFound()
    return invoice
  },
  component: InvoicePage,
})

function InvoicePage() {
  const invoice = Route.useLoaderData()
  return (
    <div className="min-h-screen">
      <SiteHeader />
      <main className="mx-auto w-full max-w-xl px-5 py-16">
        <p className="text-sm uppercase tracking-wide text-muted">
          {invoice.sample ? 'TEST invoice' : 'Invoice'} · {invoice.status}
        </p>
        <h1 className="mt-3 font-display text-4xl tracking-tight">
          {invoice.partnerOne} and {invoice.partnerTwo}
        </h1>
        <p className="mt-4 text-ink-soft">{longDate(invoice.eventDate)}</p>
        {invoice.status === 'void' ? (
          <p className="mt-6 text-sm">This invoice is void. The balance is zero.</p>
        ) : null}
        <dl className="mt-8 grid gap-2 text-sm">
          <Row label="Total" value={cad(invoice.totalCents)} />
          <Row label="Deposit" value={cad(invoice.depositCents)} />
          <Row label="Received" value={cad(invoice.receivedCents)} />
          <Row label="Balance" value={cad(invoice.balanceCents)} />
        </dl>
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
      <dd>{value}</dd>
    </div>
  )
}

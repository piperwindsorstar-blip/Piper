import { createFileRoute } from '@tanstack/react-router'
import { longDate } from '../../lib/crm/dates.ts'
import { getLeads } from '../../lib/crm/desk.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/leads')({
  head: () => privateHead('Leads · Piper DJing'),
  loader: () => getLeads(),
  component: LeadsPage,
})

function LeadsPage() {
  const leads = Route.useLoaderData()
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-4xl tracking-tight">Leads</h1>
      {leads.length === 0 ? <p>No inquiries yet.</p> : null}
      {leads.map((lead) => (
        <article
          key={lead.id}
          className="rounded-card border border-line bg-ivory px-5 py-5"
        >
          <h2 className="font-display text-2xl">
            {lead.partnerOne} and {lead.partnerTwo}
          </h2>
          <p className="mt-2 text-sm text-muted">
            {lead.email}
            {lead.phone ? ` · ${lead.phone}` : ''} · {lead.packageName}
            {lead.eventDate ? ` · ${longDate(lead.eventDate)}` : ''}
          </p>
          {lead.withStag ? (
            <p className="mt-1 text-sm text-muted">
              Add a stag and doe on its own date
              {lead.stagDate ? ` · ${longDate(lead.stagDate)}` : ''}
            </p>
          ) : null}
          {lead.message ? (
            <p className="mt-3 text-sm text-ink-soft">{lead.message}</p>
          ) : null}
        </article>
      ))}
    </div>
  )
}

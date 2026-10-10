import { createFileRoute } from '@tanstack/react-router'
import { DeskTitle } from '../../components/desk-ui.tsx'
import { longDate } from '../../lib/crm/dates.ts'
import { getLeads } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/leads')({
  head: () => deskHead('Leads · Piper DJing'),
  loader: () => getLeads(),
  component: LeadsPage,
})

function LeadsPage() {
  const leads = Route.useLoaderData()
  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Leads" title="Leads" />
      {leads.length === 0 ? (
        <p className="text-sm text-white/65">No inquiries yet.</p>
      ) : null}
      {leads.map((lead) => (
        <article
          key={lead.id}
          className="rounded-2xl border border-white/10 bg-ink-900 p-5"
        >
          <h2 className="font-display text-xl font-bold">
            {lead.partnerOne} and {lead.partnerTwo}
          </h2>
          <p className="mt-2 text-sm text-white/65">
            {lead.email}
            {lead.phone ? ` · ${lead.phone}` : ''} · {lead.packageName}
            {lead.eventDate ? ` · ${longDate(lead.eventDate)}` : ''}
          </p>
          {lead.withStag ? (
            <p className="mt-1 text-sm text-white/65">
              Add a stag and doe on its own date
              {lead.stagDate ? ` · ${longDate(lead.stagDate)}` : ''}
            </p>
          ) : null}
          {lead.message ? (
            <p className="mt-3 text-sm text-white/85">{lead.message}</p>
          ) : null}
        </article>
      ))}
    </div>
  )
}

import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskDanger,
  deskPrimary,
} from '../../components/desk-ui.tsx'
import { longDate } from '../../lib/crm/dates.ts'
import { deleteLead, getLeads, saveLead } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

const deskRoute = getRouteApi('/desk')

export const Route = createFileRoute('/desk/leads')({
  head: () => deskHead('Leads · Piper DJing'),
  loader: () => getLeads(),
  component: LeadsPage,
})

function LeadsPage() {
  const leads = Route.useLoaderData()
  const { packages } = deskRoute.useLoaderData()
  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Leads" title="Leads">
        <p className="mt-1 text-sm text-white/65">
          Saving a lead does not change its booking. Deleting a lead leaves the
          booking.
        </p>
      </DeskTitle>
      {leads.length === 0 ? (
        <p className="text-sm text-white/65">No inquiries yet.</p>
      ) : null}
      {leads.map((lead) => (
        <LeadCard key={lead.id} lead={lead} packages={packages} />
      ))}
    </div>
  )
}

function LeadCard({
  lead,
  packages,
}: {
  lead: {
    id: number
    partnerOne: string
    partnerTwo: string
    email: string
    phone: string
    eventDate: string | null
    packageId: string
    packageName: string
    withStag: boolean
    stagDate: string | null
    message: string
  }
  packages: { id: string; name: string }[]
}) {
  const save = useServerFn(saveLead)
  const remove = useServerFn(deleteLead)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const [withStag, setWithStag] = useState(lead.withStag)

  return (
    <form
      className={`${deskCard} grid gap-3`}
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        const stag = form.get('withStag') === 'on'
        void save({
          data: {
            id: lead.id,
            partnerOne: String(form.get('partnerOne') ?? ''),
            partnerTwo: String(form.get('partnerTwo') ?? ''),
            email: String(form.get('email') ?? ''),
            phone: String(form.get('phone') ?? ''),
            eventDate: String(form.get('eventDate') ?? ''),
            packageId: String(form.get('packageId') ?? lead.packageId),
            withStag: stag,
            stagDate: stag ? String(form.get('stagDate') ?? '') : '',
            message: String(form.get('message') ?? ''),
          },
        }).then(async (result) => {
          setNotice(result.ok ? 'Saved.' : result.error)
          if (result.ok) await router.invalidate()
        })
      }}
    >
      <h2 className="font-display text-xl font-bold">
        {lead.partnerTwo
          ? `${lead.partnerOne} and ${lead.partnerTwo}`
          : lead.partnerOne}
        {lead.eventDate ? (
          <span className="mt-1 block text-sm font-normal text-white/65">
            {longDate(lead.eventDate)}
          </span>
        ) : null}
      </h2>
      <div className="grid gap-3 md:grid-cols-2">
        <label className="field">
          First partner
          <input name="partnerOne" required defaultValue={lead.partnerOne} />
        </label>
        <label className="field">
          Second partner
          <input name="partnerTwo" defaultValue={lead.partnerTwo} />
        </label>
        <label className="field">
          Email
          <input name="email" required defaultValue={lead.email} />
        </label>
        <label className="field">
          Phone
          <input name="phone" defaultValue={lead.phone} />
        </label>
        <label className="field">
          Wedding date
          <input
            name="eventDate"
            type="date"
            defaultValue={lead.eventDate ?? ''}
          />
        </label>
        <label className="field">
          Package
          <select name="packageId" defaultValue={lead.packageId}>
            {packages.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
            {packages.some((item) => item.id === lead.packageId) ? null : (
              <option value={lead.packageId}>{lead.packageName}</option>
            )}
          </select>
        </label>
      </div>
      <label className="flex items-center gap-3 text-sm text-white/85">
        <input
          name="withStag"
          type="checkbox"
          checked={withStag}
          onChange={(event) => setWithStag(event.target.checked)}
        />
        Add a stag and doe on its own date
      </label>
      {withStag ? (
        <label className="field">
          Stag date
          <input
            name="stagDate"
            type="date"
            defaultValue={lead.stagDate ?? ''}
          />
        </label>
      ) : null}
      <label className="field">
        Note
        <textarea name="message" rows={3} defaultValue={lead.message} />
      </label>
      <div className="flex flex-wrap gap-3">
        <button type="submit" className={deskPrimary}>
          Save
        </button>
        <button
          type="button"
          className={deskDanger}
          onClick={() => {
            void remove({ data: { id: lead.id } }).then(async (result) => {
              setNotice(result.ok ? 'Deleted.' : result.error)
              if (result.ok) await router.invalidate()
            })
          }}
        >
          Delete
        </button>
      </div>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
    </form>
  )
}

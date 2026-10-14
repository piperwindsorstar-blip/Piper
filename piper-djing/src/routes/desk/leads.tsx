import { createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { Mail, Phone } from 'lucide-react'
import {
  DeskTitle,
  deskCard,
  deskDanger,
  deskGhost,
  deskPrimary,
  deskSurface,
} from '../../components/desk-ui.tsx'
import { longDate } from '../../lib/crm/dates.ts'
import { deleteLead, getLeads, saveLead } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'

const deskRoute = getRouteApi('/desk')

export const Route = createFileRoute('/desk/leads')({
  head: () => deskHead('Leads · DJ Piper P'),
  loader: () => getLeads(),
  component: LeadsPage,
})

function LeadsPage() {
  const leads = Route.useLoaderData()
  const { packages } = deskRoute.useLoaderData()
  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Leads" title="Leads">
        New inquiries from the website, newest first. Email or call straight
        from here. Deleting an inquiry never opens a booked date.
      </DeskTitle>
      {leads.length === 0 ? (
        <p className={`${deskCard} text-sm text-white/65`}>
          No inquiries right now. New ones from the website land here.
        </p>
      ) : null}
      <div className="grid gap-3">
        {leads.map((lead) => (
          <LeadCard key={lead.id} lead={lead} packages={packages} />
        ))}
      </div>
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
  const [confirmDelete, setConfirmDelete] = useState(false)

  const names = lead.partnerTwo
    ? `${lead.partnerOne} and ${lead.partnerTwo}`
    : lead.partnerOne
  const phone = lead.phone.replace(/[^\d+]/g, '')
  return (
    <article className={deskCard}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">{names}</h2>
          <p className="mt-0.5 text-sm text-white/65">
            {lead.eventDate ? longDate(lead.eventDate) : 'No date yet'}
            {lead.packageName ? ` · ${lead.packageName}` : ''}
            {lead.withStag ? ' · with a stag and doe' : ''}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {lead.email ? (
            <a className={deskPrimary} href={`mailto:${lead.email}`}>
              <Mail className="h-4 w-4" aria-hidden="true" />
              Email
            </a>
          ) : null}
          {phone ? (
            <a className={deskGhost} href={`tel:${phone}`}>
              <Phone className="h-4 w-4" aria-hidden="true" />
              Call
            </a>
          ) : null}
        </div>
      </div>
      {lead.message.trim() ? (
        <p className="mt-3 rounded-xl bg-white/5 px-3 py-2 text-sm whitespace-pre-line text-white/85">
          {lead.message}
        </p>
      ) : null}
      <p className="mt-2 text-xs text-white/65">
        {[lead.email, lead.phone].filter(Boolean).join(' · ')}
      </p>
      <details className="group mt-3 border-t border-white/10 pt-2">
        <summary className="flex min-h-11 cursor-pointer list-none items-center text-sm font-semibold text-hot [&::-webkit-details-marker]:hidden">
          <span className="group-open:hidden">Edit details</span>
          <span className="hidden group-open:inline">Hide details</span>
        </summary>
    <form
      className="mt-2 grid gap-3"
      onSubmit={(event) => event.preventDefault()}
    >
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
        <ActionButton
          className={deskPrimary}
          checkForm
          busy="Saving…"
          done="Saved"
          surface={deskSurface}
          onRun={async (form: FormData): Promise<RunResult | undefined> => {
            const stag = form.get('withStag') === 'on'
            const result = await save({
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
            })
            setNotice(result.ok ? 'Saved.' : result.error)
            if (result.ok) await router.invalidate()
            return {
              ok: result.ok,
              message: result.ok ? 'Saved.' : result.error,
            }
          }}
        >
          Save
        </ActionButton>
        {confirmDelete ? (
          <>
            <button
              type="button"
              className={deskDanger}
              onClick={() => {
                void remove({ data: { id: lead.id } }).then(async (result) => {
                  setNotice(result.ok ? 'Deleted.' : result.error)
                  if (result.ok) await router.invalidate()
                  else setConfirmDelete(false)
                })
              }}
            >
              Delete this inquiry
            </button>
            <button
              type="button"
              className={deskGhost}
              onClick={() => setConfirmDelete(false)}
            >
              Keep it
            </button>
          </>
        ) : (
          <button
            type="button"
            className={deskDanger}
            onClick={() => setConfirmDelete(true)}
          >
            Delete
          </button>
        )}
      </div>
      {notice ? <p className="text-sm text-white/85" role="status">{notice}</p> : null}
    </form>
      </details>
    </article>
  )
}

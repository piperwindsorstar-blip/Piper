import { Link, createFileRoute, getRouteApi, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { Check, Mail, Phone, TriangleAlert } from 'lucide-react'
import {
  CoupleName,
  DeskTitle,
  deskCard,
  deskDark,
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
  const { packages, bookings, externalDates } = deskRoute.useLoaderData()
  const [copied, setCopied] = useState(false)
  const same = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase()
  /** The booking this inquiry already became (the website makes one when the date is free). */
  const bookingFor = (lead: (typeof leads)[number]) =>
    bookings.find(
      (booking) =>
        (booking.status === 'open' || booking.status === 'hold' || booking.status === 'booked') &&
        booking.eventDate === lead.eventDate &&
        same(booking.partnerOne, lead.partnerOne) &&
        same(booking.partnerTwo, lead.partnerTwo),
    ) ?? null
  /** Who already has a date: your held or booked couples, and Pynx dates. */
  const taken = (date: string | null, ownId: number | null): string | null => {
    if (!date) return null
    const own = bookings.find(
      (booking) =>
        !booking.sample &&
        booking.id !== ownId &&
        (booking.status === 'hold' || booking.status === 'booked') &&
        booking.eventDate === date,
    )
    if (own) return `${own.partnerOne} & ${own.partnerTwo}${own.status === 'hold' ? ' (held)' : ''}`
    const other = externalDates.find((row) => !row.released && row.eventDate === date)
    return other ? `${other.company} gig` : null
  }
  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Your book" title="Leads">
        New inquiries from the website, newest first. Email or call straight
        from here. Deleting an inquiry never opens a booked date.
      </DeskTitle>
      {leads.length === 0 ? (
        <section
          aria-labelledby="no-leads"
          className="flex flex-wrap items-center justify-between gap-6 rounded-[20px] border border-[#eadff5] bg-[linear-gradient(135deg,#ffe6f2_0%,#eee8ff_55%,#e3f4fd_100%)] p-7 sm:p-9"
        >
          <div className="grid max-w-xl gap-2">
            <h2 id="no-leads" className="font-display text-3xl leading-[1.05] font-extrabold tracking-[-0.02em] sm:text-[40px]">
              No new inquiries.{' '}
              <em className="font-serif font-normal tracking-normal text-[#d1006b] italic">Yet.</em>
            </h2>
            <p className="text-[#4a4262] sm:text-lg">
              When a couple checks a date on the website, it lands here with their date already
              checked against your book.
            </p>
          </div>
          <button
            type="button"
            className={deskDark}
            onClick={() => {
              void navigator.clipboard?.writeText(`${window.location.origin}/book`).then(() => {
                setCopied(true)
                window.setTimeout(() => setCopied(false), 2000)
              })
            }}
          >
            {copied ? 'Link copied' : 'Copy the check-a-date link'}
          </button>
        </section>
      ) : null}
      <div className="grid gap-3">
        {leads.map((lead) => {
          const booking = bookingFor(lead)
          return (
            <LeadCard
              key={lead.id}
              lead={lead}
              packages={packages}
              bookingId={booking?.id ?? null}
              clash={taken(lead.eventDate, booking?.id ?? null)}
            />
          )
        })}
      </div>
    </div>
  )
}

function LeadCard({
  lead,
  packages,
  clash,
  bookingId,
}: {
  /** The booking this inquiry already became, if any. */
  bookingId: number | null
  /** Who already has this date, or null when it is free. */
  clash: string | null
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
    <article className={`${deskCard} grid gap-3`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-display text-2xl font-extrabold tracking-tight sm:text-3xl">
            {lead.partnerTwo ? <CoupleName one={lead.partnerOne} two={lead.partnerTwo} /> : names}
          </h2>
          <p className="mt-0.5 text-[#4a4262]">
            {lead.eventDate ? longDate(lead.eventDate) : 'No date yet'}
            {lead.packageName ? ` · ${lead.packageName}` : ''}
            {lead.withStag ? ' · with a stag and doe' : ''}
          </p>
        </div>
        {lead.eventDate ? (
          clash ? (
            <span className="inline-flex items-center gap-2 rounded-[10px] bg-rose-50 px-3 py-2 text-sm font-bold text-rose-800">
              <TriangleAlert className="h-4.5 w-4.5" aria-hidden="true" />
              Taken: {clash}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 rounded-[10px] bg-[#dcf3e7] px-3 py-2 text-sm font-bold text-[#0b5e41]">
              <Check className="h-4.5 w-4.5" aria-hidden="true" />
              Date is free
            </span>
          )
        ) : null}
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
        {bookingId != null ? (
          <Link to="/desk/bookings" search={{ couple: bookingId }} className={deskDark}>
            Open the booking
          </Link>
        ) : (
          <Link to="/desk/bookings" search={{ lead: lead.id }} className={deskDark}>
            Make it a booking
          </Link>
        )}
      </div>
      {lead.message.trim() ? (
        <p className="rounded-xl bg-[#faf8fe] px-4 py-3 text-sm whitespace-pre-line text-[#3b3352]">
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

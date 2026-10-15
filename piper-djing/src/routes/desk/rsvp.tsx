import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskGhost,
  deskPrimary,
  deskSurface,
  ConfirmDelete,
  deskDanger,
} from '../../components/desk-ui.tsx'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'
import { priceLabel } from '../../lib/rsvp/model.ts'
import {
  createRsvpByHand,
  createSampleRsvp,
  getRsvpDailyStatus,
  getRsvpDesk,
  markRsvpPaid,
  makeRsvpSignInLink,
  openRsvpDesk,
  removeRsvpDesk,
} from '../../lib/rsvp/rsvp.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/rsvp')({
  head: () => deskHead('RSVP · DJ Piper P'),
  loader: async () => {
    const [rows, daily] = await Promise.all([getRsvpDesk(), getRsvpDailyStatus()])
    return { rows, daily }
  },
  component: RsvpDesk,
})

function RsvpDesk() {
  const { rows, daily } = Route.useLoaderData()
  const sample = useServerFn(createSampleRsvp)
  const open = useServerFn(openRsvpDesk)
  const signInLink = useServerFn(makeRsvpSignInLink)
  const [copiedFor, setCopiedFor] = useState('')
  const pay = useServerFn(markRsvpPaid)
  const remove = useServerFn(removeRsvpDesk)
  const router = useRouter()
  const [notice, setNotice] = useState('')
  return (
    <div className="grid gap-6">
      <DeskTitle kicker="RSVP" title="Wedding RSVPs">
        A Piper couple (deposit in) is $20 and anyone else $30, plus 13% HST
        when bought by card on /rsvp. Sites you make here are free. The guest
        link starts with /rsvp.
      </DeskTitle>
      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className={deskPrimary}
          onClick={() => {
            void sample().then(async (result) => {
              if (!result.ok) {
                setNotice('The sample wedding could not open. Try again.')
                return
              }
              // Creating it also signs the desk into it, so go straight there.
              await router.navigate({ to: '/rsvp/manage' })
            })
          }}
        >
          Open the sample wedding
        </button>
        <Link to="/rsvp" className={deskGhost}>
          Public page
        </Link>
      </div>
      {notice ? <p className="text-sm text-emerald-700">{notice}</p> : null}
      <p className="text-sm text-white/60">
        {daily
          ? `Automatic reminders last ran ${new Intl.DateTimeFormat('en-CA', {
              timeZone: 'America/Toronto',
              dateStyle: 'medium',
              timeStyle: 'short',
            }).format(new Date(daily.ranAt))}. ${daily.note}`
          : 'Automatic reminders run every morning around 8. They have not run yet.'}
      </p>
      <MakeByHand onMade={setNotice} />
      <ul className="grid gap-3">
        {rows.map((row) => (
          <li
            key={row.slug}
            className={`${deskCard} flex flex-wrap items-center justify-between gap-3`}
          >
            <div>
              <p className="font-semibold">{row.couple}</p>
              <p className="text-sm text-white/60">
                {row.path} · {priceLabel(row.cents)} ·{' '}
                {row.paid ? 'Paid' : 'Due'}
                {row.sample ? ' · Sample' : ''} · {row.parties} parties
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                className={deskGhost}
                onClick={() => {
                  void open({ data: { slug: row.slug } }).then(() => {
                    void router.navigate({ to: '/rsvp/manage' })
                  })
                }}
              >
                Open
              </button>
              {row.sample ? null : (
                <button
                  type="button"
                  className={deskGhost}
                  title="A link that signs them in for one day. Text it to the couple."
                  onClick={() => {
                    void signInLink({ data: { slug: row.slug } }).then(async (result) => {
                      if (!result.ok) {
                        setNotice('The sign-in link could not be made.')
                        return
                      }
                      try {
                        await navigator.clipboard.writeText(result.url)
                        setCopiedFor(row.slug)
                        setNotice(`Sign-in link for ${row.couple} copied. It works for one day.`)
                      } catch {
                        setNotice(`Sign-in link for ${row.couple}: ${result.url}`)
                      }
                    })
                  }}
                >
                  {copiedFor === row.slug ? 'Link copied' : 'Copy sign-in link'}
                </button>
              )}
              <button
                type="button"
                className={deskGhost}
                onClick={() => {
                  void pay({ data: { slug: row.slug, paid: !row.paid } }).then(
                    () => router.invalidate(),
                  )
                }}
              >
                {row.paid ? 'Mark unpaid' : 'Mark paid'}
              </button>
              <ConfirmDelete
                className={deskDanger}
                onConfirm={() => {
                  void remove({ data: { slug: row.slug } }).then(() =>
                    router.invalidate(),
                  )
                }}
              >
                Delete
              </ConfirmDelete>
            </div>
            <DeskTimeline moments={row.timeline} />
          </li>
        ))}
      </ul>
    </div>
  )
}

/**
 * The couple's full day for DJ Piper P, private moments included. Read-only:
 * the couple edits it on their own Timeline tab.
 */
function DeskTimeline({
  moments,
}: {
  moments: {
    id: string
    time: string
    title: string
    location: string
    note: string
    guests: boolean
  }[]
}) {
  return (
    <details className="w-full">
      <summary className="min-h-11 cursor-pointer py-2 text-sm text-white/70">
        Timeline · {moments.length === 0 ? 'not started' : `${moments.length} moments`}
      </summary>
      {moments.length === 0 ? (
        <p className="pb-2 text-sm text-white/50">
          The couple has not added their day yet.
        </p>
      ) : (
        <ol className="grid gap-2 pb-2">
          {moments.map((moment) => (
            <li
              key={moment.id}
              className="grid grid-cols-[5.5rem_minmax(0,1fr)] gap-3 text-sm"
            >
              <span className="font-semibold">{moment.time}</span>
              <span>
                <span className="font-semibold">{moment.title}</span>
                {moment.guests ? null : (
                  <span className="ml-2 rounded-full border border-white/30 px-2 py-0.5 text-xs text-white/70">
                    Private
                  </span>
                )}
                <span className="block text-white/60">
                  {moment.location}
                  {moment.note ? ` · ${moment.note}` : ''}
                </span>
              </span>
            </li>
          ))}
        </ol>
      )}
    </details>
  )
}

/** The owner makes a couple's site for free; it is live straight away. */
function MakeByHand({ onMade }: { onMade: (notice: string) => void }) {
  const make = useServerFn(createRsvpByHand)
  const router = useRouter()
  return (
    <details className={deskCard}>
      <summary className="min-h-11 cursor-pointer py-2 font-semibold">
        Make a couple's RSVP site by hand (free)
      </summary>
      <form
        className="mt-3 grid gap-3 sm:grid-cols-2"
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="field">
          First partner
          <input name="partnerOne" required />
        </label>
        <label className="field">
          Second partner
          <input name="partnerTwo" required />
        </label>
        <label className="field">
          Couple's email
          <input name="email" type="email" required />
        </label>
        <label className="field">
          Wedding date
          <input name="eventDate" type="date" required />
        </label>
        <label className="field sm:col-span-2">
          Venue (optional)
          <input name="venue" />
        </label>
        <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
          <input name="sendLink" type="checkbox" defaultChecked />
          Email them a sign-in link to their dashboard
        </label>
        <ActionButton
          className={`${deskPrimary} w-fit`}
          checkForm
          busy="Making…"
          done="Made"
          surface={deskSurface}
          onRun={async (form: FormData): Promise<RunResult> => {
            const result = await make({
              data: {
                partnerOne: String(form.get('partnerOne') ?? ''),
                partnerTwo: String(form.get('partnerTwo') ?? ''),
                email: String(form.get('email') ?? ''),
                eventDate: String(form.get('eventDate') ?? ''),
                venue: String(form.get('venue') ?? ''),
                sendLink: form.get('sendLink') === 'on',
              },
            })
            if (!result.ok) return { ok: false, message: result.error }
            const message = `Made /rsvp/${result.slug}.${result.mailed ? ' Sign-in link sent.' : ''}`
            onMade(message)
            await router.invalidate()
            return { ok: true, message }
          }}
        >
          Make the site
        </ActionButton>
      </form>
    </details>
  )
}

import { Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { priceLabel } from '../../lib/rsvp/model.ts'
import {
  findInvitation,
  unlockRsvpCode,
} from '../../lib/rsvp/rsvp.functions.ts'
import type { getRsvpHome } from '../../lib/rsvp/rsvp.functions.ts'
import {
  Field,
  RsvpFrame,
  RsvpHeader,
  Steps,
  rsvpButton,
  rsvpField,
  rsvpGhost,
} from './shell.tsx'
import { TheDay } from './timeline.tsx'

export type HomeData = Awaited<ReturnType<typeof getRsvpHome>>
type ShownHome = Exclude<HomeData, { entry: 'missing' } | { entry: 'unpaid' }>

export function GuestHome({ data }: { data: HomeData }) {
  if (data.entry === 'missing') {
    return (
      <RsvpFrame>
        <RsvpHeader />
        <h1 className="portal-display text-4xl">That RSVP is not here.</h1>
        <Link to="/rsvp" className={`${rsvpButton} mt-8`}>
          Start an RSVP
        </Link>
      </RsvpFrame>
    )
  }
  if (data.entry === 'unpaid') {
    return (
      <RsvpFrame>
        <RsvpHeader />
        <p className="text-xs tracking-[0.18em] text-[var(--text-muted)]">
          RSVP
        </p>
        <h1 className="portal-display mt-3 text-4xl">{data.couple}</h1>
        <p className="mt-4 text-[var(--text-muted)]">
          This guest link turns on when the {priceLabel(data.cents)} payment is
          recorded. A paid Piper date is $20. A standalone RSVP is $30.
        </p>
      </RsvpFrame>
    )
  }
  if (data.entry === 'code') return <CodeGate slug={data.slug} home={data} />
  if (data.entry === 'find') return <FindInvitation slug={data.slug} />
  return <WeddingHome data={data} />
}

function CodeGate({ slug, home }: { slug: string; home: ShownHome }) {
  const unlock = useServerFn(unlockRsvpCode)
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <RsvpFrame>
      <RsvpHeader />
      <p className="text-center text-xs tracking-[0.2em] text-[var(--text-muted)]">
        YOU&apos;RE INVITED
      </p>
      <h1 className="portal-display mt-3 text-center text-5xl">
        {home.couple}
      </h1>
      <p className="mt-3 text-center text-[var(--text-muted)]">
        {home.dateLabel}
        <br />
        {home.venue}
      </p>
      <form
        className="mt-8 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          void unlock({ data: { slug, code } }).then(async (result) => {
            if (!result.ok) {
              setError(
                'error' in result && result.error
                  ? result.error
                  : 'That code does not match the invitation.',
              )
              setBusy(false)
              return
            }
            await router.invalidate()
            setBusy(false)
          })
        }}
      >
        <Field id="invite-code" label="Invite code" error={error}>
          <input
            id="invite-code"
            className={rsvpField}
            value={code}
            autoComplete="off"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'invite-code-error' : 'invite-help'}
            onChange={(event) => setCode(event.target.value)}
          />
        </Field>
        <p id="invite-help" className="mt-2 text-sm text-[var(--text-faint)]">
          It&apos;s printed on your invitation card, under the QR code.
        </p>
        <button className={`${rsvpButton} mt-4`} type="submit" disabled={busy}>
          Open invitation →
        </button>
      </form>
      {home.showContact && home.contactPhone ? (
        <p className="mt-6 text-center text-sm text-[var(--text-muted)]">
          Trouble getting in? Text {home.contactName} at {home.contactPhone}
        </p>
      ) : null}
    </RsvpFrame>
  )
}

function WeddingHome({ data }: { data: ShownHome }) {
  const days =
    data.daysLeft === null
      ? ''
      : data.daysLeft >= 0
        ? `${data.daysLeft} days left · takes about 2 minutes`
        : 'The reply window has closed'
  return (
    <RsvpFrame>
      <RsvpHeader />
      <p className="text-xs tracking-[0.18em] text-[var(--text-muted)]">
        THE WEDDING OF
      </p>
      <h1 className="portal-display mt-2 text-5xl">{data.couple}</h1>
      <section className="mt-6 rounded-3xl border border-[var(--pink)] bg-[var(--surface)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="font-semibold">Please RSVP by {data.deadline}</p>
            <p className="mt-1 text-sm text-[var(--text-muted)]">{days}</p>
          </div>
          <span className="rounded-full bg-[var(--pink-tint)] px-3 py-1 text-xs text-[var(--pink-soft)]">
            Open
          </span>
        </div>
        <Link
          to="/rsvp/$slug/find"
          params={{ slug: data.slug }}
          className={`${rsvpButton} mt-4`}
        >
          RSVP now
        </Link>
      </section>
      {data.day.length > 0 ? (
        <TheDay moments={data.day} />
      ) : (
        <>
        <h2 className="mt-8 text-xs tracking-[0.18em] text-[var(--text-muted)]">
          SCHEDULE
        </h2>
        <ul className="mt-3 grid gap-3">
          {data.schedule.map((item) => (
            <li
              key={`${item.name}-${item.time}`}
              className="flex items-center justify-between gap-3 rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
            >
              <span>
                <span className="block font-semibold">{item.name}</span>
                <span className="text-sm text-[var(--text-muted)]">
                  {item.time}
                  {item.place ? ` · ${item.place}` : ''}
                </span>
              </span>
              {item.note ? (
                <span className="text-sm text-[var(--text-faint)]">
                  {item.note}
                </span>
              ) : null}
            </li>
          ))}
        </ul>
        </>
      )}
      {data.notes.length > 0 ? (
        <>
          <h2
            id="details"
            className="mt-8 text-xs tracking-[0.18em] text-[var(--text-muted)]"
          >
            GOOD TO KNOW
          </h2>
          <ul className="mt-3 grid gap-2 text-sm text-[var(--text-muted)]">
            {data.notes.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </>
      ) : null}
      {data.caterer ? (
        <p className="mt-6 text-sm text-[var(--text-faint)]">
          The caterer needs counts by {data.caterer}.
        </p>
      ) : null}
    </RsvpFrame>
  )
}

export function FindInvitation({ slug }: { slug: string }) {
  const find = useServerFn(findInvitation)
  const router = useRouter()
  const [first, setFirst] = useState('')
  const [last, setLast] = useState('')
  const [error, setError] = useState('')
  const [found, setFound] = useState<{
    token: string
    partyName: string
    line: string
  } | null>(null)
  const [busy, setBusy] = useState(false)
  return (
    <RsvpFrame>
      <RsvpHeader step="Step 1 of 3" />
      <Steps step={1} />
      <h1 className="portal-display text-4xl">Find your invitation</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        Enter your name as it appears on the envelope. You&apos;ll be able to
        reply for everyone in your party.
      </p>
      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          setFound(null)
          void find({ data: { slug, first, last } }).then((result) => {
            setBusy(false)
            if (!result.ok) {
              setError(result.error)
              return
            }
            setFound(result)
          })
        }}
      >
        <Field id="first-name" label="First name">
          <input
            id="first-name"
            className={rsvpField}
            autoComplete="given-name"
            value={first}
            onChange={(event) => setFirst(event.target.value)}
          />
        </Field>
        <Field
          id="last-name"
          label="Last name"
          error={error && !found ? error : ''}
        >
          <input
            id="last-name"
            className={rsvpField}
            autoComplete="family-name"
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'last-name-error' : undefined}
            value={last}
            onChange={(event) => setLast(event.target.value)}
          />
        </Field>
        <button className={rsvpButton} type="submit" disabled={busy}>
          {found ? 'Try again' : 'Find my invitation'}
        </button>
      </form>
      {found ? (
        <section className="mt-4 rounded-3xl border border-emerald-500/70 bg-[var(--surface)] p-4">
          <p className="text-xs tracking-[0.16em] text-emerald-300">
            WE FOUND YOU
          </p>
          <h2 className="portal-display mt-2 text-2xl">{found.partyName}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{found.line}</p>
          <button
            type="button"
            className={`${rsvpButton} mt-4`}
            onClick={() => {
              void router.navigate({
                to: '/rsvp/$slug/p/$token',
                params: { slug, token: found.token },
              })
            }}
          >
            Yes, that&apos;s us →
          </button>
        </section>
      ) : null}
      {error && !found ? (
        <section className="mt-4 rounded-3xl border border-[var(--pink)] bg-[var(--surface)] p-4 text-sm">
          <p className="font-semibold">We couldn&apos;t find that name</p>
          <ul className="mt-2 grid gap-1 text-[var(--text-muted)]">
            <li>Try the full name on the envelope.</li>
            <li>Try a maiden name or the other name on the envelope.</li>
            <li>Check the spelling.</li>
          </ul>
        </section>
      ) : null}
      <p className="mt-6 text-center text-sm text-[var(--text-faint)]">
        Only your own party is shown — we never list other guests.
      </p>
      {error && !found ? (
        <a className={`${rsvpGhost} mt-4`} href="#details">
          Contact the couple
        </a>
      ) : null}
    </RsvpFrame>
  )
}

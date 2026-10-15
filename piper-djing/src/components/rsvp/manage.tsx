import { Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  Armchair,
  CalendarDays,
  Ellipsis,
  LayoutDashboard,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { priceLabel } from '../../lib/rsvp/model.ts'
import {
  askRsvpQuestion,
  downloadRsvpCsv,
  emailRsvpInvitations,
  markRsvpReply,
  removeRsvpParty,
  saveRsvpParty,
  saveRsvpReplyEmail,
  saveRsvpSetup,
  saveSongStatus,
  sendRsvpReminders,
  sendTestRsvpEmail,
  setRsvpTheme,
} from '../../lib/rsvp/rsvp.functions.ts'
import { GuestPaste } from './guest-paste.tsx'
import { MealOptions } from './meal-options.tsx'
import {
  CatererPrintDialog,
  PrintTimeline,
  SeatingPrintDialog,
  usePrintSheet,
} from './print.tsx'
import type { CatererSheet } from '../../lib/rsvp/caterer.ts'
import type { SeatingData } from './seating.tsx'
import type { TimelineData } from './timeline.tsx'
import type { getRsvpManage } from '../../lib/rsvp/rsvp.functions.ts'
import {
  RsvpLogo,
  RsvpThemeProvider,
  downloadText,
  rsvpButton,
  rsvpField,
  rsvpGhost,
  useRsvpTheme,
} from './shell.tsx'
import { ActionButton } from '../action-button.tsx'
import type { RunResult } from '../action-button.tsx'

export type ManageData = NonNullable<Awaited<ReturnType<typeof getRsvpManage>>>
export type ReadyManage = Extract<ManageData, { mode: 'ready' }>

const LINKS = [
  { to: '/rsvp/manage', label: 'Overview' },
  { to: '/rsvp/manage/design', label: 'Invitations' },
  { to: '/rsvp/manage/guests', label: 'Guests & parties' },
  { to: '/rsvp/manage/events', label: 'Events & questions' },
  { to: '/rsvp/manage/seating', label: 'Seating chart' },
  { to: '/rsvp/manage/timeline', label: 'Timeline' },
  { to: '/rsvp/manage/songs', label: 'Song requests' },
  { to: '/rsvp/manage/exports', label: 'Exports' },
  { to: '/rsvp/manage/settings', label: 'Site settings' },
] as const

const PRIMARY = [
  { to: '/rsvp/manage', label: 'Overview', Icon: LayoutDashboard },
  { to: '/rsvp/manage/guests', label: 'Guests', Icon: Users },
  { to: '/rsvp/manage/events', label: 'Events', Icon: CalendarDays },
  { to: '/rsvp/manage/seating', label: 'Seating', Icon: Armchair },
] as const

const MORE = LINKS.filter(
  (link) => !PRIMARY.some((primary) => primary.to === link.to),
)

export function ManageShell({
  data,
  children,
}: {
  data: ReadyManage
  children: ReactNode
}) {
  const theme = data.wedding.theme
  const [more, setMore] = useState(false)
  const couple = `${data.wedding.partnerOne} & ${data.wedding.partnerTwo}`
  const days =
    data.daysLeft === null
      ? ''
      : data.daysLeft === 0
        ? ' · today'
        : data.daysLeft < 0
          ? ''
          : ` · ${data.daysLeft} ${data.daysLeft === 1 ? 'day' : 'days'}`
  const when = `${headerDate(data.wedding.eventDate)}${days}`
  return (
    <RsvpThemeProvider theme={theme}>
      <div
        className={`portal min-h-screen print:block print:min-h-0 print:!bg-none md:grid md:grid-cols-[240px_1fr] ${theme === 'light' ? 'light' : ''}`}
        style={
          theme === 'light'
            ? undefined
            : {
                backgroundImage:
                  'radial-gradient(ellipse at left, #2A1220 0%, #0D0D0D 55%)',
              }
        }
      >
        <header className="flex items-center justify-between gap-3 border-b border-[var(--border)] px-4 py-3 print:hidden md:hidden">
          <RsvpLogo className="h-8 w-auto" />
          <div className="min-w-0 text-right">
            <p className="truncate text-sm font-semibold">{couple}</p>
            <p className="truncate text-xs text-[var(--text-muted)]">{when}</p>
          </div>
        </header>
        <aside className="hidden p-4 print:hidden md:block md:border-r md:border-[var(--border)]">
          <div className="mb-6">
            <RsvpLogo />
          </div>
          <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
            WEDDING
          </p>
          <p className="mt-1 font-semibold">{couple}</p>
          <p className="text-sm text-[var(--text-muted)]">{when}</p>
          <nav className="mt-6 grid gap-1" aria-label="Wedding sections">
            {LINKS.map((link) => (
              <Link
                key={link.to}
                to={link.to}
                className="min-h-11 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] data-[status=active]:bg-[var(--field)] data-[status=active]:text-[var(--text)]"
                activeOptions={{ exact: link.to === '/rsvp/manage' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <ThemeToggle theme={theme} />
          <p className="mt-8 text-sm text-[var(--text-faint)]">
            DJ Piper P keeps the song requests with the wedding plan.
          </p>
        </aside>
        <div className="min-w-0 p-4 pb-28 print:p-0 md:p-8 md:pb-8">
          {children}
        </div>
        <nav
          aria-label="Wedding sections"
          className="fixed inset-x-0 bottom-0 z-30 grid grid-cols-5 border-t border-[var(--border)] bg-[var(--surface)] pb-[env(safe-area-inset-bottom)] print:hidden md:hidden"
        >
          {PRIMARY.map(({ to, label, Icon }) => (
            <Link
              key={to}
              to={to}
              onClick={() => setMore(false)}
              className="flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] text-[var(--text-muted)] data-[status=active]:text-[var(--pink)]"
              activeOptions={{ exact: to === '/rsvp/manage' }}
            >
              <Icon size={20} aria-hidden="true" />
              {label}
            </Link>
          ))}
          <button
            type="button"
            aria-expanded={more}
            onClick={() => setMore((open) => !open)}
            className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] ${more ? 'text-[var(--pink)]' : 'text-[var(--text-muted)]'}`}
          >
            <Ellipsis size={20} aria-hidden="true" />
            More
          </button>
        </nav>
        {more ? (
          <div
            className="fixed inset-0 z-40 bg-black/50 print:hidden md:hidden"
            onClick={() => setMore(false)}
          >
            <div
              role="dialog"
              aria-label="More sections"
              className="absolute inset-x-0 bottom-0 rounded-t-[24px] border border-[var(--border)] bg-[var(--surface)] p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
              onClick={(event) => event.stopPropagation()}
            >
              <div className="flex items-center justify-between">
                <p className="font-semibold">More</p>
                <button
                  type="button"
                  aria-label="Close"
                  className="grid h-11 w-11 place-items-center"
                  onClick={() => setMore(false)}
                >
                  <X size={20} aria-hidden="true" />
                </button>
              </div>
              <nav className="mt-2 grid gap-1">
                {MORE.map((link) => (
                  <Link
                    key={link.to}
                    to={link.to}
                    onClick={() => setMore(false)}
                    className="min-h-12 rounded-xl px-3 py-3 text-base data-[status=active]:bg-[var(--field)]"
                  >
                    {link.label}
                  </Link>
                ))}
              </nav>
              <ThemeToggle theme={theme} />
            </div>
          </div>
        ) : null}
      </div>
    </RsvpThemeProvider>
  )
}

/** "2027-06-12" → "Sat, Jun 12, 2027" for the dashboard header. */
function headerDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(Date.UTC(year, month - 1, day)))
}

function ThemeToggle({ theme }: { theme: 'dark' | 'light' }) {
  const save = useServerFn(setRsvpTheme)
  const router = useRouter()
  return (
    <button
      type="button"
      className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-strong)] px-3 text-sm font-semibold text-[var(--text)]"
      onClick={() => {
        void save({
          data: { theme: theme === 'light' ? 'dark' : 'light' },
        }).then(async () => {
          await router.invalidate()
        })
      }}
    >
      {theme === 'light' ? 'Switch to dark' : 'Switch to light'}
    </button>
  )
}

export function PayWall({
  data,
}: {
  data: Extract<ManageData, { mode: 'pay' }>
}) {
  const piper = data.kind === 'piper'
  return (
    <main className="portal mx-auto grid min-h-screen max-w-xl content-center px-6">
      <p className="text-xs tracking-[0.18em] text-[var(--text-muted)]">RSVP</p>
      <h1 className="portal-display mt-3 text-5xl">{data.couple}</h1>
      <p className="mt-4 text-3xl font-semibold">{priceLabel(data.cents)}</p>
      <p className="mt-3 text-[var(--text-muted)]">
        {piper
          ? 'This is the $20 price because this email is on a paid Piper date.'
          : 'This is the $30 standalone price. A couple who has already paid Piper pays $20.'}
      </p>
      <p className="mt-3 text-[var(--text-muted)]">
        The guest link {data.path} turns on when Piper records the payment.
      </p>
    </main>
  )
}

export function Overview({ data }: { data: ReadyManage }) {
  const { stats } = data
  const replied = stats.attending + stats.declined
  const total = Math.max(stats.guests, 1)
  const empty = stats.guests === 0
  const setup = (
    <section aria-labelledby="rsvp-setup">
      <h2 id="rsvp-setup" className="portal-display text-2xl">
        {empty ? 'Start with your guest list' : 'Set up'}
      </h2>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        {empty
          ? 'Paste the names, and each party gets one link to reply.'
          : 'Your guest list, meal choices, reply email and questions.'}
      </p>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <GuestPaste
          key={data.wedding.parties
            .map(
              (party) =>
                `${party.id}:${party.token}:${party.guests.map((guest) => guest.id).join('.')}`,
            )
            .join('|')}
          parties={data.wedding.parties}
          publicLink={data.publicLink}
        />
        <div className="grid content-start gap-4">
          <ReplyEmail data={data} />
          <AskQuestion questions={data.questions} />
        </div>
      </div>
      <div className="mt-4">
        <MealOptions key={mealsOf(data).join('\u0000')} meals={mealsOf(data)} />
      </div>
    </section>
  )
  return (
    <div>
      <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
        OVERVIEW
      </p>
      <div className="mt-2 flex flex-wrap items-center justify-between gap-3">
        <h1 className="portal-display text-4xl">{data.greeting}</h1>
        <Link
          to="/rsvp/$slug"
          params={{ slug: data.wedding.slug }}
          className="inline-flex min-h-11 items-center rounded-full border border-[var(--border-strong)] px-4 text-sm"
        >
          View guest site →
        </Link>
      </div>
      {empty ? (
        <div className="mt-6">{setup}</div>
      ) : (
        <>
          <section
            aria-label="Replies"
            className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5"
          >
            <div className="flex flex-wrap items-end justify-between gap-3">
              <div>
                <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">
                  REPLIES
                </p>
                <p className="mt-1 text-4xl font-semibold">
                  {replied}
                  <span className="text-xl font-normal text-[var(--text-muted)]">
                    {' '}
                    of {stats.guests} guests
                  </span>
                </p>
              </div>
              <div className="text-right text-sm">
                <p className="text-[var(--text-muted)]">RSVP deadline</p>
                <p className="font-semibold text-[var(--pink)]">
                  {data.deadlineLabel || '—'}
                </p>
                {data.catererLabel ? (
                  <p className="text-[var(--text-faint)]">
                    Caterer {data.catererLabel}
                  </p>
                ) : null}
              </div>
            </div>
            <div
              className="mt-4 flex h-3 overflow-hidden rounded-full bg-[var(--field)]"
              role="img"
              aria-label={`${stats.attending} attending, ${stats.declined} can't make it, ${stats.waitingGuests} waiting`}
            >
              <span
                className="bg-emerald-400"
                style={{ width: `${(stats.attending / total) * 100}%` }}
              />
              <span
                className="bg-rose-400"
                style={{ width: `${(stats.declined / total) * 100}%` }}
              />
              <span
                className="bg-amber-400"
                style={{ width: `${(stats.waitingGuests / total) * 100}%` }}
              />
            </div>
            <ul className="mt-3 flex flex-wrap gap-x-5 gap-y-1 text-sm">
              <Legend
                dot="bg-emerald-400"
                text={`${stats.attending} attending`}
              />
              <Legend
                dot="bg-rose-400"
                text={`${stats.declined} can't make it`}
              />
              <Legend
                dot="bg-amber-400"
                text={`${stats.waitingGuests} waiting · ${stats.waitingParties} ${stats.waitingParties === 1 ? 'party' : 'parties'}`}
              />
            </ul>
            {stats.waitingParties > 0 ? (
              <Link
                to="/rsvp/manage/guests"
                className="mt-4 inline-flex min-h-11 items-center rounded-full bg-[var(--pink)] px-5 text-sm font-semibold text-[#0D0D0D]"
              >
                See who is still waiting →
              </Link>
            ) : null}
          </section>
          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="font-semibold">Latest replies</h2>
              {stats.latest.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                  Nobody has replied yet.
                </p>
              ) : (
                <ul className="mt-3 grid gap-3">
                  {stats.latest.map((party) => (
                    <li
                      key={party.partyId}
                      className="grid grid-cols-[minmax(0,1fr)_auto] items-baseline gap-x-3 text-sm"
                    >
                      <span className="truncate font-medium">{party.name}</span>
                      <span className="text-[var(--text-faint)]">
                        {party.ago}
                      </span>
                      <span
                        className={
                          party.tone === 'no'
                            ? 'text-rose-300 [.light_&]:text-rose-700'
                            : 'text-emerald-300 [.light_&]:text-emerald-700'
                        }
                      >
                        {party.label}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </section>
            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-5">
              <h2 className="font-semibold">By event</h2>
              <ul className="mt-3 grid gap-2 text-sm">
                {stats.byEvent.map((event) => (
                  <li key={event.id} className="flex justify-between gap-3">
                    <span>{event.name}</span>
                    <span className="shrink-0">
                      {event.attending} attending
                    </span>
                  </li>
                ))}
              </ul>
              <h2 className="mt-5 font-semibold">Meals so far</h2>
              <p className="mt-2 text-sm text-[var(--text-muted)]">
                {stats.meals.length === 0
                  ? 'No meals yet.'
                  : stats.meals
                      .map((meal) => `${meal.label} ${meal.count}`)
                      .join(' · ')}
              </p>
            </section>
          </div>
          <div className="mt-8">{setup}</div>
        </>
      )}
    </div>
  )
}

function Legend({ dot, text }: { dot: string; text: string }) {
  return (
    <li className="flex items-center gap-2 text-[var(--text-muted)]">
      <span className={`h-2.5 w-2.5 rounded-full ${dot}`} aria-hidden="true" />
      {text}
    </li>
  )
}

function mealsOf(data: ReadyManage): string[] {
  return (
    data.wedding.questions.find((question) => question.type === 'choice')
      ?.options ?? []
  )
}

function ReplyEmail({ data }: { data: ReadyManage }) {
  const save = useServerFn(saveRsvpReplyEmail)
  const router = useRouter()
  const [email, setEmail] = useState(data.wedding.replyEmail)
  const surface = useSurface()
  const hint = data.wedding.replyEmail
    ? 'A confirmed RSVP is emailed to the couple at this address.'
    : data.replyTarget
      ? 'A confirmed RSVP is emailed to the address on their Piper date. Save a couple address here to use that instead.'
      : "Enter the couple's email. A confirmed RSVP is emailed to them."
  return (
    <form
      className="mt-6 grid gap-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="text-sm" htmlFor="reply-email">
        Couple's email
        <input
          id="reply-email"
          type="email"
          autoComplete="email"
          className={`${rsvpField} mt-1`}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
      </label>
      <p className="text-sm text-[var(--text-muted)]">{hint}</p>
      <ActionButton
        className={`${rsvpButton} w-auto justify-self-start px-6`}
        busy="Saving…"
        done="Saved"
        surface={surface}
        onRun={async () => {
          const result = await save({ data: { email } })
          if (result.ok) await router.invalidate()
          return {
            ok: result.ok,
            message: result.ok ? 'Saved.' : result.error,
          }
        }}
      >
        Save
      </ActionButton>
    </form>
  )
}

function AskQuestion({ questions }: { questions: ReadyManage['questions'] }) {
  const ask = useServerFn(askRsvpQuestion)
  const router = useRouter()
  const [text, setText] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <h2 className="font-semibold">Ask a question</h2>
      <form
        className="mt-3 grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          if (!text.trim() || busy) return
          setBusy(true)
          setNotice('')
          void ask({ data: { text } }).then(async (result) => {
            setBusy(false)
            if (!result.ok) {
              setNotice(result.error)
              return
            }
            setText('')
            setNotice(result.notice)
            await router.invalidate()
          })
        }}
      >
        <label className="text-sm" htmlFor="ask-question">
          Your question
          <textarea
            id="ask-question"
            className={`${rsvpField} mt-1 min-h-28 py-3`}
            value={text}
            onChange={(event) => setText(event.target.value)}
          />
        </label>
        <button
          className={`${rsvpButton} w-auto`}
          type="submit"
          disabled={busy}
        >
          Send
        </button>
      </form>
      {notice ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">{notice}</p>
      ) : null}
      <ul className="mt-4 grid gap-3">
        {questions.map((question) => (
          <li key={question.id} className="text-sm">
            <p>{question.text}</p>
            <p className="mt-1 text-[var(--text-faint)]">
              {askedWhen(question.askedAt)}
            </p>
            {question.reply ? (
              <p className="mt-2 rounded-2xl bg-[var(--field)] p-3">
                {question.reply}
              </p>
            ) : (
              <p className="mt-2 text-[var(--text-muted)]">
                Waiting for a reply
              </p>
            )}
          </li>
        ))}
      </ul>
    </section>
  )
}

function askedWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

export function Guests({ data }: { data: ReadyManage }) {
  const save = useServerFn(saveRsvpParty)
  const remove = useServerFn(removeRsvpParty)
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<'all' | 'waiting' | 'replied' | 'plus'>(
    'all',
  )
  const [editing, setEditing] = useState<string | null>(null)
  const [error, setError] = useState('')
  const everyone = data.wedding.parties
  const counts = {
    all: everyone.length,
    waiting: everyone.filter((party) => !party.lastRepliedAt).length,
    replied: everyone.filter((party) => party.lastRepliedAt).length,
    plus: everyone.filter(
      (party) =>
        party.guests.some((guest) => guest.isPlusOne) || party.plusOneAllowed,
    ).length,
  }
  const parties = data.wedding.parties.filter((party) => {
    const blob =
      `${party.name} ${party.guests.map((guest) => `${guest.firstName} ${guest.lastName} ${guest.altNames.join(' ')}`).join(' ')}`.toLowerCase()
    if (query && !blob.includes(query.toLowerCase())) return false
    if (filter === 'waiting') return !party.lastRepliedAt
    if (filter === 'replied') return Boolean(party.lastRepliedAt)
    if (filter === 'plus')
      return (
        party.guests.some((guest) => guest.isPlusOne) || party.plusOneAllowed
      )
    return true
  })
  const current =
    data.wedding.parties.find((party) => party.id === editing) ?? null
  // Only "new" opens an empty form; an id that is gone (just deleted) opens
  // nothing, so a deleted party never reappears as an Add party dialog.
  const drawerOpen = editing === 'new' || current !== null
  const close = () => {
    setEditing(null)
    setError('')
  }
  return (
    <div>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
            GUESTS & PARTIES
          </p>
          <h1 className="portal-display text-4xl">
            {data.stats.guests} guests in {data.stats.parties} parties
          </h1>
        </div>
        <div className="flex flex-wrap items-start gap-2">
          <EmailAllButton data={data} />
          <button
            type="button"
            className={`${rsvpButton} !w-auto`}
            onClick={() => setEditing('new')}
          >
            + Add party
          </button>
        </div>
      </div>
      <div className="mt-4 flex flex-wrap gap-2">
        <input
          className={`${rsvpField} max-w-xs`}
          placeholder="Search names, nicknames..."
          aria-label="Search guests"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />
        {(
          [
            ['all', 'All'],
            ['waiting', 'Waiting'],
            ['replied', 'Replied'],
            ['plus', 'Plus-ones'],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            aria-pressed={filter === id}
            className={`min-h-11 rounded-full border px-3 text-sm ${filter === id ? 'border-[var(--pink)] bg-[var(--pink-tint)] text-[var(--text)]' : 'border-[var(--border-strong)] text-[var(--text-muted)]'}`}
            onClick={() => setFilter(id)}
          >
            {label}
            <span className="ml-1.5 text-[var(--text-faint)]">
              {counts[id]}
            </span>
          </button>
        ))}
      </div>
      <ul className="mt-4 grid gap-2">
        {parties.map((party) => (
          <li key={party.id}>
            <button
              type="button"
              className="flex min-h-11 w-full items-center justify-between rounded-2xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left"
              onClick={() => setEditing(party.id)}
            >
              <span>
                <span className="block font-semibold">{party.name}</span>
                <span className="text-sm text-[var(--text-muted)]">
                  {party.guests
                    .map(
                      (guest) =>
                        `${guest.firstName}${guest.altNames[0] ? ` (${guest.altNames[0]})` : ''}${guest.isChild ? ' (child)' : ''}`,
                    )
                    .join(', ')}
                </span>
              </span>
              <span className="grid shrink-0 justify-items-end gap-1 pl-3 text-sm">
                <span
                  className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                    party.lastRepliedAt
                      ? party.phoneReply
                        ? 'bg-sky-400/15 text-sky-300 [.light_&]:text-sky-700'
                        : 'bg-emerald-400/15 text-emerald-300 [.light_&]:text-emerald-700'
                      : 'bg-amber-400/15 text-amber-300 [.light_&]:text-amber-700'
                  }`}
                >
                  {party.lastRepliedAt
                    ? party.phoneReply
                      ? 'Marked by you'
                      : 'Replied'
                    : 'Waiting'}
                </span>
                {data.invited[party.id] ? (
                  <span className="text-xs text-emerald-500">
                    ✓ Sent {shortWhen(data.invited[party.id] ?? '')}
                  </span>
                ) : null}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {drawerOpen ? (
        <PartyDrawer
          // A fresh form every time it opens: nothing carries over from the
          // last party saved, deleted or closed.
          key={editing ?? 'closed'}
          party={current}
          events={data.wedding.events}
          meals={mealsOf(data)}
          invitedAt={current ? (data.invited[current.id] ?? '') : ''}
          error={error}
          onClose={close}
          onDelete={() => {
            if (!current) return
            const id = current.id
            close()
            void remove({ data: { id } }).then(() => router.invalidate())
          }}
          onSave={async (draft) => {
            setError('')
            const result = await save({ data: draft })
            if (!result.ok) {
              const message =
                'error' in result ? result.error : 'Could not save that party.'
              setError(message)
              return { ok: false, message }
            }
            close()
            await router.invalidate()
            return { ok: true, message: 'Party saved.' }
          }}
        />
      ) : null}
    </div>
  )
}

function PartyDrawer({
  party,
  events,
  meals,
  invitedAt,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  party: ReadyManage['wedding']['parties'][number] | null
  events: ReadyManage['wedding']['events']
  meals: string[]
  invitedAt: string
  error: string
  onClose: () => void
  onDelete: () => void
  onSave: (draft: Record<string, unknown>) => Promise<RunResult>
}) {
  const [name, setName] = useState(party?.name ?? '')
  const [email, setEmail] = useState(party?.email ?? '')
  const [plusOneAllowed, setPlus] = useState(party?.plusOneAllowed ?? false)
  const [eventIds, setEventIds] = useState<string[]>(
    party?.eventIds ?? events.map((event) => event.id),
  )
  const surface = useSurface()
  const [guests, setGuests] = useState(
    party?.guests.map((guest) => ({
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      altNames: guest.altNames.join(', '),
      isChild: guest.isChild,
      isPlusOne: guest.isPlusOne,
      plusOneAllowed: guest.plusOneAllowed,
    })) ?? [
      {
        id: '',
        firstName: '',
        lastName: '',
        altNames: '',
        isChild: false,
        isPlusOne: false,
        plusOneAllowed: false,
      },
    ],
  )
  return (
    <div className="fixed inset-0 z-40 grid items-end bg-black/60 sm:items-center sm:justify-center">
      <form
        className="max-h-[90vh] w-full overflow-auto rounded-t-3xl bg-[var(--surface)] p-5 sm:max-w-lg sm:rounded-3xl"
        onSubmit={(event) => event.preventDefault()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-xl font-semibold">
            {party ? `Edit party · ${party.name}` : 'Add party'}
          </h2>
          <button
            type="button"
            className="min-h-11 px-3"
            onClick={onClose}
            aria-label="Close"
          >
            ×
          </button>
        </div>
        <label className="mt-4 block text-sm" htmlFor="party-name">
          Party name
        </label>
        <input
          id="party-name"
          className={`${rsvpField} mt-1`}
          value={name}
          onChange={(event) => setName(event.target.value)}
        />
        <label className="mt-3 block text-sm" htmlFor="party-email">
          Email for reminders
        </label>
        <input
          id="party-email"
          className={`${rsvpField} mt-1`}
          value={email}
          onChange={(event) => setEmail(event.target.value)}
        />
        {guests.map((guest, index) => (
          <div
            key={guest.id || index}
            className="mt-4 grid gap-2 rounded-2xl border border-[var(--border)] p-3"
          >
            <label className="text-sm" htmlFor={`guest-first-${index}`}>
              First name
            </label>
            <input
              id={`guest-first-${index}`}
              className={rsvpField}
              value={guest.firstName}
              onChange={(event) =>
                updateGuest(index, { firstName: event.target.value })
              }
            />
            <label className="text-sm" htmlFor={`guest-last-${index}`}>
              Last name
            </label>
            <input
              id={`guest-last-${index}`}
              className={rsvpField}
              value={guest.lastName}
              onChange={(event) =>
                updateGuest(index, { lastName: event.target.value })
              }
            />
            <label className="text-sm" htmlFor={`guest-alt-${index}`}>
              Also finds them by
            </label>
            <input
              id={`guest-alt-${index}`}
              className={rsvpField}
              placeholder="Bill, Will"
              value={guest.altNames}
              onChange={(event) =>
                updateGuest(index, { altNames: event.target.value })
              }
            />
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={guest.isChild}
                onChange={(event) =>
                  updateGuest(index, { isChild: event.target.checked })
                }
              />
              Child
            </label>
            <label className="flex min-h-11 items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={guest.plusOneAllowed}
                onChange={(event) =>
                  updateGuest(index, { plusOneAllowed: event.target.checked })
                }
              />
              Allow a plus-one
            </label>
          </div>
        ))}
        <button
          type="button"
          className={`${rsvpGhost} mt-3`}
          onClick={() =>
            setGuests((current) => [
              ...current,
              {
                id: '',
                firstName: '',
                lastName: '',
                altNames: '',
                isChild: false,
                isPlusOne: false,
                plusOneAllowed: false,
              },
            ])
          }
        >
          Add a guest
        </button>
        <label className="mt-4 flex min-h-11 items-center justify-between text-sm">
          Plus-one allowed
          <input
            type="checkbox"
            checked={plusOneAllowed}
            onChange={(event) => setPlus(event.target.checked)}
          />
        </label>
        <fieldset className="mt-3">
          <legend className="text-sm">Invited to</legend>
          <div className="mt-2 flex flex-wrap gap-2">
            {events.map((event) => {
              const on = eventIds.includes(event.id)
              return (
                <button
                  key={event.id}
                  type="button"
                  aria-pressed={on}
                  className={`min-h-11 rounded-full border px-3 text-sm ${on ? 'border-[var(--pink)] text-[var(--pink-soft)]' : 'border-[var(--border-strong)]'}`}
                  onClick={() =>
                    setEventIds((current) =>
                      on
                        ? current.filter((id) => id !== event.id)
                        : [...current, event.id],
                    )
                  }
                >
                  {event.name}
                </button>
              )
            })}
          </div>
        </fieldset>
        {party ? (
          <MarkReply party={party} events={events} meals={meals} />
        ) : null}
        {party ? (
          <EmailPartyButton
            partyId={party.id}
            email={party.email}
            invitedAt={invitedAt}
          />
        ) : null}
        {error ? (
          <p className="mt-3 text-sm text-[var(--pink-soft)]">{error}</p>
        ) : null}
        <div className="mt-4 grid grid-cols-2 gap-2">
          {party ? (
            <button type="button" className={rsvpGhost} onClick={onDelete}>
              Delete party
            </button>
          ) : (
            <span />
          )}
          <ActionButton
            className={rsvpButton}
            wrapperClassName="grid"
            busy="Saving…"
            done="Saved"
            surface={surface}
            onRun={() =>
              onSave({
                id: party?.id ?? '',
                name,
                email,
                plusOneAllowed,
                eventIds,
                guests,
              })
            }
          >
            Save
          </ActionButton>
        </div>
      </form>
    </div>
  )

  function updateGuest(index: number, patch: Partial<(typeof guests)[number]>) {
    setGuests((current) =>
      current.map((guest, guestIndex) =>
        guestIndex === index ? { ...guest, ...patch } : guest,
      ),
    )
  }
}

type Reply = 'attending' | 'declined' | 'pending'

/**
 * For a phone call or a paper card: the couple marks each guest's reply
 * (and dinner) themselves. Saves straight to the list; no email is sent.
 */
function MarkReply({
  party,
  events,
  meals,
}: {
  party: ReadyManage['wedding']['parties'][number]
  events: ReadyManage['wedding']['events']
  meals: string[]
}) {
  const mark = useServerFn(markRsvpReply)
  const router = useRouter()
  const surface = useSurface()
  const invited = events.filter((event) => party.eventIds.includes(event.id))
  const [open, setOpen] = useState(false)
  const [guests, setGuests] = useState(() =>
    party.guests.map((guest) => ({
      id: guest.id,
      name: `${guest.firstName} ${guest.lastName}`.trim() || 'Guest',
      isChild: guest.isChild,
      meal: guest.meal,
      replies: Object.fromEntries(
        invited.map((event) => {
          const value = guest.replies[event.id]
          return [
            event.id,
            (value === 'attending' || value === 'declined'
              ? value
              : 'pending') as Reply,
          ]
        }),
      ) as Record<string, Reply>,
    })),
  )
  if (invited.length === 0 || party.guests.length === 0) return null
  const setReply = (index: number, eventId: string, value: Reply) =>
    setGuests((current) =>
      current.map((guest, at) =>
        at === index
          ? { ...guest, replies: { ...guest.replies, [eventId]: value } }
          : guest,
      ),
    )
  return (
    <section className="mt-5 rounded-2xl border border-[var(--border)] p-3">
      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold">Mark their reply</h3>
        <button
          type="button"
          className="min-h-11 px-2 text-sm text-[var(--pink-soft)] underline underline-offset-4"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
        >
          {open ? 'Hide' : party.phoneReply ? 'Change' : 'Mark reply'}
        </button>
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Got their answer by phone or a paper card? Mark it here. No email is
        sent.
      </p>
      {open ? (
        <div className="mt-3 grid gap-3">
          {guests.map((guest, index) => {
            const wantsMeal =
              !guest.isChild &&
              meals.length > 0 &&
              invited.some(
                (event) =>
                  event.asksMeal && guest.replies[event.id] === 'attending',
              )
            return (
              <div
                key={guest.id}
                className="grid gap-2 rounded-xl border border-[var(--border)] p-3"
              >
                <p className="font-semibold">{guest.name}</p>
                {invited.map((event) => (
                  <fieldset key={event.id} className="grid gap-1">
                    <legend className="text-sm text-[var(--text-muted)]">
                      {invited.length > 1 ? event.name : 'Coming?'}
                    </legend>
                    <div className="flex flex-wrap gap-2">
                      {(
                        [
                          ['attending', 'Attending'],
                          ['declined', 'Not attending'],
                          ['pending', 'No reply'],
                        ] as const
                      ).map(([value, label]) => {
                        const on = guest.replies[event.id] === value
                        return (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={on}
                            className={`min-h-11 rounded-full border px-3 text-sm ${on ? 'border-[var(--pink)] text-[var(--pink-soft)]' : 'border-[var(--border-strong)]'}`}
                            onClick={() => setReply(index, event.id, value)}
                          >
                            {label}
                          </button>
                        )
                      })}
                    </div>
                  </fieldset>
                ))}
                {wantsMeal ? (
                  <label className="grid gap-1 text-sm">
                    Dinner
                    <select
                      className={rsvpField}
                      value={guest.meal}
                      onChange={(event) => {
                        const meal = event.target.value
                        setGuests((current) =>
                          current.map((item, at) =>
                            at === index ? { ...item, meal } : item,
                          ),
                        )
                      }}
                    >
                      <option value="">Not chosen yet</option>
                      {meals.map((meal) => (
                        <option key={meal} value={meal}>
                          {meal}
                        </option>
                      ))}
                    </select>
                  </label>
                ) : null}
              </div>
            )
          })}
          <ActionButton
            className={rsvpButton}
            wrapperClassName="grid"
            busy="Saving…"
            done="Saved"
            surface={surface}
            onRun={async (): Promise<RunResult> => {
              const result = await mark({
                data: {
                  partyId: party.id,
                  guests: guests.map((guest) => ({
                    id: guest.id,
                    replies: guest.replies,
                    meal: guest.meal,
                  })),
                },
              })
              if (!result.ok) {
                return {
                  ok: false,
                  message:
                    'error' in result
                      ? result.error
                      : 'Could not save that reply.',
                }
              }
              await router.invalidate()
              return { ok: true, message: 'Reply saved. No email was sent.' }
            }}
          >
            Save reply
          </ActionButton>
        </div>
      ) : null}
    </section>
  )
}

function EmailAllButton({ data }: { data: ReadyManage }) {
  const send = useServerFn(emailRsvpInvitations)
  const router = useRouter()
  const surface = useSurface()
  const ready = data.wedding.parties.filter((party) =>
    party.email.includes('@'),
  ).length
  const label = ready === 1 ? '1 party' : `${ready} parties`
  return (
    <ActionButton
      className={`${rsvpGhost} !w-auto`}
      busy="Sending…"
      done="Sent"
      surface={surface}
      disabled={ready === 0}
      disabledHint="Add an email to a party first."
      lastUsed={data.invitedAt ? `Sent ${shortWhen(data.invitedAt)}` : ''}
      confirmMessage={`Email the invitation to ${label}?`}
      onRun={async (): Promise<RunResult> => {
        try {
          const result = await send({ data: { all: true } })
          await router.invalidate()
          return { ok: result.ok, message: result.detail }
        } catch {
          return { ok: false, message: 'The invitations did not send.' }
        }
      }}
    >
      Email all invitations
    </ActionButton>
  )
}

function EmailPartyButton({
  partyId,
  email,
  invitedAt,
}: {
  partyId: string
  email: string
  invitedAt: string
}) {
  const send = useServerFn(emailRsvpInvitations)
  const router = useRouter()
  const surface = useSurface()
  const [sentAt, setSentAt] = useState(invitedAt)
  const hasEmail = email.includes('@')
  const last = sentAt || invitedAt
  return (
    <div className="mt-4 flex flex-wrap items-center gap-3">
      <ActionButton
        className={`${rsvpGhost} w-auto`}
        busy="Sending…"
        done="Sent"
        surface={surface}
        disabled={!hasEmail}
        disabledHint="Add an email for this party first."
        onRun={async (): Promise<RunResult> => {
          try {
            const result = await send({ data: { partyId } })
            if (result.ok && result.sentAt) setSentAt(result.sentAt)
            await router.invalidate()
            return { ok: result.ok, message: result.detail }
          } catch {
            return { ok: false, message: 'The invitation did not send.' }
          }
        }}
      >
        Email invitation
      </ActionButton>
      {last ? (
        <span className="text-sm text-emerald-500" role="status">
          ✓ Sent {shortWhen(last)}
        </span>
      ) : null}
    </div>
  )
}

const EMAIL_LABELS: Record<string, string> = {
  invitation: 'Invitation',
  confirmation: 'Guest confirmation',
  reminder: 'Reminder',
  'reply-notice': 'Reply notice',
  welcome: 'Welcome receipt',
  'deadline-summary': 'Deadline summary',
  'piper-question': 'Question to Piper',
  'piper-signup': 'Signup to Piper',
  'piper-payment': 'Payment to Piper',
  'sign-in': 'Sign-in link',
  test: 'Test',
}

function emailLabel(row: { kind: string; testOf?: string }): string {
  if (row.kind === 'test' && row.testOf) {
    return `Test · ${EMAIL_LABELS[row.testOf] ?? row.testOf}`
  }
  return EMAIL_LABELS[row.kind] ?? row.kind
}

/** The portal's own light/dark choice, for the feedback colours. */
function useSurface(): 'dark' | 'light' {
  return useRsvpTheme()
}

const TORONTO = 'America/Toronto'

function dayStamp(date: Date): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: TORONTO,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date)
}

/** "today 8:15 AM", "yesterday 6:02 PM" or "Oct 13". */
function shortWhen(iso: string): string {
  const then = new Date(iso)
  if (Number.isNaN(then.getTime())) return ''
  const now = new Date()
  const stamp = dayStamp(then)
  if (stamp === dayStamp(now)) {
    return `today ${new Intl.DateTimeFormat('en-US', {
      timeZone: TORONTO,
      hour: 'numeric',
      minute: '2-digit',
    }).format(then)}`
  }
  if (stamp === dayStamp(new Date(now.getTime() - 86_400_000))) {
    return `yesterday ${new Intl.DateTimeFormat('en-US', {
      timeZone: TORONTO,
      hour: 'numeric',
      minute: '2-digit',
    }).format(then)}`
  }
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TORONTO,
    month: 'short',
    day: 'numeric',
  }).format(then)
}

function emailWhen(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(date)
}

const TEST_EMAILS = [
  ['invitation', 'Invitation'],
  ['confirmation', 'Guest confirmation'],
  ['reminder', 'Reminder'],
  ['reply-notice', 'Reply notice'],
  ['welcome', 'Welcome receipt'],
  ['deadline-summary', 'Deadline summary'],
  ['sign-in', 'Sign-in link'],
] as const

export function Events({ data }: { data: ReadyManage }) {
  const save = useServerFn(saveRsvpSetup)
  const router = useRouter()
  const [events, setEvents] = useState(data.wedding.events)
  const [deadline, setDeadline] = useState(data.wedding.deadline)
  const [caterer, setCaterer] = useState(data.wedding.catererDeadline)
  const [lockAfter, setLock] = useState(data.wedding.lockAfterDeadline)
  const [autoRemind, setRemind] = useState(data.wedding.autoRemind)
  const [notice, setNotice] = useState('')
  const [editing, setEditing] = useState('')
  const original = new Set(data.wedding.events.map((item) => item.id))
  function patchEvent(id: string, change: Partial<(typeof events)[number]>) {
    setNotice('')
    setEvents((current) =>
      current.map((item) => (item.id === id ? { ...item, ...change } : item)),
    )
  }
  return (
    <div className="grid gap-8">
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        // The meals keep their own boxes and their own save below.
        const questions = data.wedding.questions
        void save({
          data: {
            deadline,
            catererDeadline: caterer,
            lockAfterDeadline: lockAfter,
            autoRemind,
            events,
            questions,
            schedule: data.wedding.schedule,
            notes: data.wedding.notes,
            accessMode: data.wedding.accessMode,
            inviteCode: data.wedding.inviteCode,
            showContact: data.wedding.showContact,
            contactPhone: data.wedding.contactPhone,
            venue: data.wedding.venue,
            address: data.wedding.address,
          },
        }).then(async (result) => {
          setNotice(
            result.ok
              ? 'Saved.'
              : 'error' in result
                ? result.error
                : 'Could not save.',
          )
          if (result.ok) await router.invalidate()
        })
      }}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
            EVENTS & QUESTIONS
          </p>
          <h1 className="portal-display text-4xl">What guests are asked</h1>
        </div>
        <Link
          to="/rsvp/$slug/find"
          params={{ slug: data.wedding.slug }}
          className={`${rsvpButton} w-auto`}
        >
          Preview guest form
        </Link>
      </div>
      <ul className="grid gap-2">
        {events.map((item) => {
          const open = editing === item.id
          return (
            <li
              key={item.id}
              className={`rounded-2xl border px-4 py-3 ${item.enabled ? 'border-[var(--border)]' : 'border-dashed border-[var(--border)] opacity-80'}`}
            >
              <div className="flex items-center justify-between gap-3">
                <span className="min-w-0">
                  <span className="block font-semibold">{item.name || 'Name this event'}</span>
                  <span className="block text-sm text-[var(--text-muted)]">
                    {[item.dateLabel, item.time, item.location].filter(Boolean).join(' · ') ||
                      'Add a time and place'}
                  </span>
                </span>
                <button
                  type="button"
                  aria-pressed={item.enabled}
                  aria-label={`${item.name}: ${item.enabled ? 'guests are asked' : 'off'}`}
                  className={`min-h-11 shrink-0 rounded-full px-4 text-sm font-semibold ${
                    item.enabled
                      ? 'bg-[var(--pink)] text-[#0D0D0D]'
                      : 'border border-[var(--border-strong)] text-[var(--text-muted)]'
                  }`}
                  onClick={() => patchEvent(item.id, { enabled: !item.enabled })}
                >
                  {item.enabled ? 'On' : 'Off'}
                </button>
              </div>
              {open ? (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <label className="text-sm sm:col-span-2">
                    Name
                    <input
                      className={`${rsvpField} mt-1`}
                      maxLength={80}
                      value={item.name}
                      placeholder="Sunday brunch"
                      onChange={(event) => patchEvent(item.id, { name: event.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    Day
                    <input
                      className={`${rsvpField} mt-1`}
                      maxLength={80}
                      value={item.dateLabel}
                      placeholder="Saturday, June 12"
                      onChange={(event) => patchEvent(item.id, { dateLabel: event.target.value })}
                    />
                  </label>
                  <label className="text-sm">
                    Time
                    <input
                      className={`${rsvpField} mt-1`}
                      maxLength={40}
                      value={item.time}
                      placeholder="4:00 PM"
                      onChange={(event) => patchEvent(item.id, { time: event.target.value })}
                    />
                  </label>
                  <label className="text-sm sm:col-span-2">
                    Place
                    <input
                      className={`${rsvpField} mt-1`}
                      maxLength={80}
                      value={item.location}
                      placeholder={data.wedding.venue || 'The venue'}
                      onChange={(event) => patchEvent(item.id, { location: event.target.value })}
                    />
                  </label>
                  <span className="flex flex-wrap gap-3 sm:col-span-2">
                    <button type="button" className={`${rsvpGhost} w-auto`} onClick={() => setEditing('')}>
                      Done
                    </button>
                    {original.has(item.id) || events.length <= 1 ? null : (
                      <button
                        type="button"
                        className="min-h-11 text-sm text-[var(--text-muted)] underline"
                        onClick={() => {
                          setEditing('')
                          setEvents((current) => current.filter((event) => event.id !== item.id))
                        }}
                      >
                        Remove this event
                      </button>
                    )}
                  </span>
                </div>
              ) : (
                <button
                  type="button"
                  className="mt-1 min-h-11 text-sm text-[var(--text-muted)] underline"
                  onClick={() => setEditing(item.id)}
                >
                  Edit name, time and place
                </button>
              )}
            </li>
          )
        })}
      </ul>
      {events.length < 8 ? (
        <button
          type="button"
          className={`${rsvpGhost} w-auto justify-self-start`}
          onClick={() => {
            const id = `event-${Date.now().toString(36)}`
            setEvents((current) => [
              ...current,
              {
                id,
                name: '',
                dateLabel: '',
                time: '',
                location: '',
                note: '',
                enabled: true,
                asksMeal: false,
                hidden: false,
              },
            ])
            setEditing(id)
          }}
        >
          + Add an event
        </button>
      ) : null}
      {events.some((item) => !original.has(item.id)) ? (
        <p className="text-sm text-[var(--text-muted)]">
          Everyone already on your list is invited to a new event. You can untick it for a party in Guests.
        </p>
      ) : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="text-sm" htmlFor="deadline">
          Deadline
          <input
            id="deadline"
            type="date"
            className={`${rsvpField} mt-1`}
            value={deadline}
            onChange={(event) => setDeadline(event.target.value)}
          />
        </label>
        <label className="text-sm" htmlFor="caterer">
          Caterer needs counts
          <input
            id="caterer"
            type="date"
            className={`${rsvpField} mt-1`}
            value={caterer}
            onChange={(event) => setCaterer(event.target.value)}
          />
        </label>
      </div>
      <label className="flex min-h-11 items-center justify-between">
        Auto-reminder 7 days before deadline
        <input
          type="checkbox"
          checked={autoRemind}
          onChange={(event) => setRemind(event.target.checked)}
        />
      </label>
      <label className="flex min-h-11 items-center justify-between">
        Lock replies after deadline
        <input
          type="checkbox"
          checked={lockAfter}
          onChange={(event) => setLock(event.target.checked)}
        />
      </label>
      <button
        className={`${rsvpButton} w-auto`}
        type="submit"
        disabled={events.some((item) => !item.name.trim())}
      >
        Save changes
      </button>
      {events.some((item) => !item.name.trim()) ? (
        <p className="text-sm text-[var(--text-muted)]">Give every event a name to save.</p>
      ) : null}
      {notice ? (
        <p className="text-sm text-[var(--text-muted)]" role="status">{notice}</p>
      ) : null}
    </form>
      <MealOptions
        key={mealsOf(data).join('\u0000')}
        meals={mealsOf(data)}
        title="Dinner options"
      />
    </div>
  )
}

const SONG_CHOICES = [
  { value: 'queued', label: 'Fine to play' },
  { value: 'must', label: 'Must play' },
  { value: 'no', label: 'Do not play' },
] as const

type SongStatus = (typeof SONG_CHOICES)[number]['value']

export function Songs({ data }: { data: ReadyManage }) {
  const save = useServerFn(saveSongStatus)
  const router = useRouter()
  /** Choices shown straight away while the save is on its way. */
  const [picked, setPicked] = useState<Record<string, SongStatus>>({})
  const [error, setError] = useState('')
  const unique = data.songs.length
  const requests = data.songs.reduce((sum, song) => sum + song.count, 0)
  return (
    <div>
      <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
        SONG REQUESTS
      </p>
      <h1 className="portal-display text-4xl">
        {requests === 0
          ? 'No requests yet'
          : `${requests} ${requests === 1 ? 'request' : 'requests'} · ${unique} ${unique === 1 ? 'song' : 'songs'}`}
      </h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        {requests === 0
          ? 'Guests can ask for a song when they reply. Their picks land here.'
          : 'Mark the ones that have to play, and any you never want played.'}
      </p>
      {error ? (
        <p className="mt-3 text-sm text-[var(--danger,#f87171)]" role="alert">
          {error}
        </p>
      ) : null}
      <ol className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
        {data.songs.map((song, index) => {
          const key = `${song.title}\u0000${song.artist}`
          const status = picked[key] ?? (song.status as SongStatus)
          return (
            <li
              key={key}
              className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">
                    {index + 1}. {song.title}
                  </p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {song.artist || 'Artist not given'}
                  </p>
                </div>
                <p className="shrink-0 text-sm text-[var(--text-muted)]">
                  {song.count} {song.count === 1 ? 'request' : 'requests'}
                </p>
              </div>
              {song.who ? (
                <p className="mt-1 text-sm text-[var(--text-faint)]">Asked by {song.who}</p>
              ) : null}
              <div
                className="mt-3 grid grid-cols-3 gap-1 rounded-full border border-[var(--border-strong)] p-1"
                role="group"
                aria-label={`What to do with ${song.title}`}
              >
                {SONG_CHOICES.map((choice) => {
                  const on = status === choice.value
                  return (
                    <button
                      key={choice.value}
                      type="button"
                      aria-pressed={on}
                      className={`min-h-11 rounded-full px-2 text-sm font-semibold ${
                        on
                          ? choice.value === 'no'
                            ? 'bg-[var(--text)] text-[var(--bg,#0d0d0d)]'
                            : 'bg-[var(--pink)] text-[#0D0D0D]'
                          : 'text-[var(--text-muted)]'
                      }`}
                      onClick={() => {
                        if (on) return
                        setError('')
                        setPicked((current) => ({ ...current, [key]: choice.value }))
                        void save({
                          data: { title: song.title, artist: song.artist, status: choice.value },
                        })
                          .then((result) => {
                            if (!result.ok) throw new Error('not saved')
                            return router.invalidate()
                          })
                          .catch(() => {
                            setPicked((current) => {
                              const next = { ...current }
                              delete next[key]
                              return next
                            })
                            setError(`Couldn't save the change to ${song.title}. Try again.`)
                          })
                      }}
                    >
                      {choice.label}
                    </button>
                  )
                })}
              </div>
            </li>
          )
        })}
      </ol>
    </div>
  )
}

export type ExportSheets = {
  seating: SeatingData | null
  timeline: TimelineData | null
  caterer: CatererSheet | null
}

export function Exports({
  data,
  sheets,
}: {
  data: ReadyManage
  sheets: ExportSheets
}) {
  const { sheet, print } = usePrintSheet()
  const [seatingPrint, setSeatingPrint] = useState(false)
  const [catererPrint, setCatererPrint] = useState(false)
  const load = useServerFn(downloadRsvpCsv)
  const router = useRouter()
  const remind = useServerFn(sendRsvpReminders)
  const test = useServerFn(sendTestRsvpEmail)
  const surface = useSurface()
  const [testKind, setTestKind] = useState<string>('invitation')
  const [testNote, setTestNote] = useState('')
  const canRemind = data.reminderManual.allowed
  const today = data.wedding.eventDate || 'rsvp'
  async function grab(
    kind: 'caterer' | 'songs' | 'guests' | 'seating' | 'timeline',
    name: string,
  ) {
    const body = await load({ data: { kind } })
    if (body)
      downloadText(`${name}-${today}.csv`, body, 'text/csv;charset=utf-8')
  }
  return (
    <div>
      {sheets.seating ? (
        <SeatingPrintDialog
          open={seatingPrint}
          onClose={() => setSeatingPrint(false)}
          plan={sheets.seating.plan}
          guests={sheets.seating.guests}
          couple={sheets.seating.couple}
          dateLabel={sheets.seating.dateLabel}
        />
      ) : null}
      {sheets.caterer ? (
        <CatererPrintDialog
          open={catererPrint}
          onClose={() => setCatererPrint(false)}
          sheet={sheets.caterer}
        />
      ) : null}
      {sheet === 'timeline' && sheets.timeline ? (
        <div className="hidden print:block">
          <PrintTimeline
            timeline={sheets.timeline.timeline}
            venue={sheets.timeline.venue}
            couple={sheets.timeline.couple}
            dateLabel={sheets.timeline.dateLabel}
          />
        </div>
      ) : null}
      <div className="print:hidden">
        <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
          EXPORTS
        </p>
        <h1 className="portal-display text-4xl">Send the numbers</h1>
        <p className="mt-2 text-[var(--text-muted)]">
          Every file opens in Excel or Google Sheets. Accents and commas are
          handled.
        </p>
        <div className="mt-6 grid gap-3 md:grid-cols-2">
          <ExportCard
            title="Caterer report"
            body="Attending guests per event: name, party, meal, dietary needs, child"
            onClick={() => void grab('caterer', 'caterer-report')}
            onPrint={sheets.caterer ? () => setCatererPrint(true) : undefined}
          />
          <ExportCard
            title="DJ song list"
            body="Unique songs, artist, request count, who asked, do-not-play"
            onClick={() => void grab('songs', 'dj-song-requests')}
          />
          <ExportCard
            title="Full guest list"
            body="Every guest, every event, status, contact email"
            onClick={() => void grab('guests', 'guest-list')}
          />
          <ExportCard
            title="Seating chart"
            body="Table, seat, party, guest, child, meal, event. Unseated attending guests are listed last."
            onClick={() => void grab('seating', 'seating-chart')}
            onPrint={sheets.seating ? () => setSeatingPrint(true) : undefined}
          />
          <ExportCard
            title="Timeline"
            body="Every moment of the day, private ones included, for you and the DJ"
            onClick={() => void grab('timeline', 'timeline')}
            onPrint={sheets.timeline ? () => print('timeline') : undefined}
          />
        </div>
        <div className="mt-4 flex flex-wrap items-start gap-3">
          <ActionButton
            className={rsvpButton}
            wrapperClassName="inline-grid w-auto"
            busy="Sending…"
            done="Sent"
            surface={surface}
            disabled={!canRemind}
            disabledHint="A manual reminder already went out in the last 24 hours."
            lastUsed={
              data.wedding.remindedManualAt
                ? `Sent ${shortWhen(data.wedding.remindedManualAt)}`
                : ''
            }
            confirmMessage={`Email the reminder to ${data.stats.waitingParties} parties still waiting?`}
            onRun={async (): Promise<RunResult> => {
              const result = await remind({ data: { now: true } })
              await router.invalidate()
              return {
                ok: result.ok,
                message: result.detail || 'The email was not sent.',
              }
            }}
          >
            Email parties still waiting
          </ActionButton>
          <p className="max-w-xs text-sm text-[var(--text-muted)]">
            Still waiting on {data.stats.waitingParties} parties. The automatic
            note goes out 7 days before the deadline.
          </p>
        </div>
        <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-semibold">Send me a test</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">
            Any email goes to the couple&apos;s own address only.
          </p>
          <div className="mt-3 flex flex-wrap items-center gap-2">
            <select
              className={`${rsvpField} max-w-xs`}
              aria-label="Email to test"
              value={testKind}
              onChange={(event) => {
                setTestKind(event.target.value)
                setTestNote('')
              }}
            >
              {TEST_EMAILS.map(([id, label]) => (
                <option key={id} value={id}>
                  {label}
                </option>
              ))}
            </select>
            <ActionButton
              className={`${rsvpGhost} w-auto`}
              busy="Sending…"
              done="Sent"
              surface={surface}
              lastUsed={
                !testNote && data.testedAt
                  ? `Last test sent ${shortWhen(data.testedAt)}`
                  : ''
              }
              onRun={async (): Promise<RunResult> => {
                setTestNote('')
                try {
                  const result = await test({ data: { kind: testKind } })
                  if (result.ok) {
                    const label =
                      TEST_EMAILS.find(([id]) => id === testKind)?.[1] ?? 'Test'
                    setTestNote(
                      `✓ ${result.detail.replace(/\.$/, '')} · ${label} · ${shortWhen(new Date().toISOString())}`,
                    )
                  }
                  await router.invalidate()
                  return {
                    ok: result.ok,
                    message: result.ok
                      ? ''
                      : result.detail || 'The test did not send.',
                  }
                } catch {
                  return {
                    ok: false,
                    message: 'The test did not send. Check your connection.',
                  }
                }
              }}
            >
              Send me a test
            </ActionButton>
          </div>
          {testNote ? (
            <p
              className={`mt-3 rounded-2xl border px-4 py-3 text-sm font-semibold ${surface === 'light' ? 'border-emerald-600/40 text-emerald-700' : 'border-emerald-400/40 text-emerald-300'}`}
              role="status"
              aria-live="polite"
            >
              {testNote}
            </p>
          ) : null}
        </section>
        <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-semibold">Emails sent</h2>
          {data.emails.length === 0 ? (
            <p className="mt-2 text-sm text-[var(--text-muted)]">
              Nothing sent yet.
            </p>
          ) : (
            <ul className="mt-3 grid gap-2 text-sm">
              {data.emails.map((row) => (
                <li
                  key={row.id}
                  className="flex flex-wrap items-center justify-between gap-2"
                >
                  <span>
                    <span className="font-semibold">{emailLabel(row)}</span>{' '}
                    <span className="text-[var(--text-muted)]">→ {row.to}</span>
                  </span>
                  <span
                    className={
                      row.delivered
                        ? 'text-emerald-300'
                        : 'text-[var(--text-faint)]'
                    }
                  >
                    {row.delivered ? 'Sent' : 'Not sent'} ·{' '}
                    {emailWhen(row.sentAt)}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  )
}

function ExportCard({
  title,
  body,
  onClick,
  onPrint,
}: {
  title: string
  body: string
  onClick: () => void
  onPrint?: () => void
}) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{body}</p>
        </div>
        <div className="flex shrink-0 flex-wrap gap-2 sm:justify-end">
          <button
            type="button"
            className="min-h-11 rounded-full border border-[var(--border-strong)] px-4 text-sm"
            onClick={onClick}
          >
            Download CSV
          </button>
          {onPrint ? (
            <button
              type="button"
              className="min-h-11 rounded-full border border-[var(--border-strong)] px-4 text-sm"
              onClick={onPrint}
            >
              Print / PDF
            </button>
          ) : null}
        </div>
      </div>
    </section>
  )
}

export function Settings({ data }: { data: ReadyManage }) {
  const save = useServerFn(saveRsvpSetup)
  const router = useRouter()
  const [accessMode, setMode] = useState(data.wedding.accessMode)
  const [inviteCode, setCode] = useState(data.wedding.inviteCode)
  const [showContact, setShow] = useState(data.wedding.showContact)
  const [contactPhone, setPhone] = useState(data.wedding.contactPhone)
  const [copied, setCopied] = useState(false)
  const surface = useSurface()
  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(event) => event.preventDefault()}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
            SITE SETTINGS
          </p>
          <h1 className="portal-display text-4xl">Share & privacy</h1>
        </div>
      </div>
      <fieldset className="grid gap-2">
        <legend className="text-sm text-[var(--text-muted)]">
          Who can open your site
        </legend>
        {(
          [
            ['code', 'Invite code', 'One code printed on every invitation.'],
            [
              'checkin',
              'Name check-in',
              'Guests must be on your list to see anything.',
            ],
            ['public', 'Public', 'Anyone with the link. Not recommended.'],
          ] as const
        ).map(([id, label, hint]) => (
          <label
            key={id}
            className={`flex min-h-11 items-start gap-3 rounded-2xl border p-3 ${accessMode === id ? 'border-[var(--pink)]' : 'border-[var(--border)]'}`}
          >
            <input
              type="radio"
              name="access"
              checked={accessMode === id}
              onChange={() => setMode(id)}
            />
            <span>
              <span className="block font-semibold">{label}</span>
              <span className="text-sm text-[var(--text-muted)]">{hint}</span>
            </span>
          </label>
        ))}
      </fieldset>
      {accessMode === 'code' ? (
        <label className="text-sm" htmlFor="invite-code">
          Invite code
          <input
            id="invite-code"
            className={`${rsvpField} mt-1`}
            value={inviteCode}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
      ) : null}
      <label className="text-sm" htmlFor="site-address">
        Site address
        <input
          id="site-address"
          className={`${rsvpField} mt-1`}
          readOnly
          value={data.publicLink.replace(/^https?:\/\//, '')}
        />
      </label>
      <button
        type="button"
        className={rsvpGhost}
        onClick={() => {
          void navigator.clipboard
            .writeText(data.publicLink)
            .then(() => setCopied(true))
        }}
      >
        {copied ? 'Copied' : 'Copy RSVP link'}
      </button>
      <label className="flex min-h-11 items-center justify-between text-sm">
        Show home address or phone numbers
        <input
          type="checkbox"
          checked={showContact}
          onChange={(event) => setShow(event.target.checked)}
        />
      </label>
      {showContact ? (
        <label className="text-sm" htmlFor="phone">
          Phone guests can text
          <input
            id="phone"
            className={`${rsvpField} mt-1`}
            value={contactPhone}
            onChange={(event) => setPhone(event.target.value)}
          />
        </label>
      ) : null}
      <ActionButton
        className={`${rsvpButton} w-auto`}
        busy="Saving…"
        done="Saved"
        surface={surface}
        onRun={async () => {
          const result = await save({
            data: {
              accessMode,
              inviteCode,
              showContact,
              contactPhone,
              deadline: data.wedding.deadline,
              catererDeadline: data.wedding.catererDeadline,
              lockAfterDeadline: data.wedding.lockAfterDeadline,
              autoRemind: data.wedding.autoRemind,
              events: data.wedding.events,
              questions: data.wedding.questions,
              schedule: data.wedding.schedule,
              notes: data.wedding.notes,
              venue: data.wedding.venue,
              address: data.wedding.address,
            },
          })
          if (result.ok) await router.invalidate()
          return {
            ok: result.ok,
            message: result.ok ? 'Saved.' : 'Could not save.',
          }
        }}
      >
        Save changes
      </ActionButton>
    </form>
  )
}

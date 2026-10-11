import { Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { priceLabel } from '../../lib/rsvp/model.ts'
import {
  downloadRsvpCsv,
  removeRsvpParty,
  saveRsvpParty,
  saveRsvpSetup,
  saveSongStatus,
} from '../../lib/rsvp/rsvp.functions.ts'
import type { getRsvpManage } from '../../lib/rsvp/rsvp.functions.ts'
import { downloadText, rsvpButton, rsvpField, rsvpGhost } from './shell.tsx'

export type ManageData = NonNullable<Awaited<ReturnType<typeof getRsvpManage>>>
export type ReadyManage = Extract<ManageData, { mode: 'ready' }>

const LINKS = [
  { to: '/rsvp/manage', label: 'Overview' },
  { to: '/rsvp/manage/guests', label: 'Guests & parties' },
  { to: '/rsvp/manage/events', label: 'Events & questions' },
  { to: '/rsvp/manage/songs', label: 'Song requests' },
  { to: '/rsvp/manage/exports', label: 'Exports' },
  { to: '/rsvp/manage/settings', label: 'Site settings' },
] as const

export function ManageShell({
  data,
  children,
}: {
  data: ReadyManage
  children: ReactNode
}) {
  return (
    <div className="portal min-h-screen md:grid md:grid-cols-[240px_1fr]">
      <aside className="border-b border-[var(--border)] p-4 md:border-b-0 md:border-r">
        <div className="mb-6 flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--pink)] font-bold text-[#0D0D0D]">
            P
          </span>
          Piper P · RSVP
        </div>
        <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
          WEDDING
        </p>
        <p className="mt-1 font-semibold">
          {data.wedding.partnerOne} & {data.wedding.partnerTwo}
        </p>
        <p className="text-sm text-[var(--text-muted)]">
          {data.wedding.eventDate}
          {data.daysLeft !== null ? ` · ${data.daysLeft} days` : ''}
        </p>
        <nav className="mt-6 flex gap-2 overflow-x-auto md:grid">
          {LINKS.map((link) => (
            <Link
              key={link.to}
              to={link.to}
              className="min-h-11 whitespace-nowrap rounded-xl px-3 py-2 text-sm text-[var(--text-muted)] data-[status=active]:bg-[var(--field)] data-[status=active]:text-white"
              activeOptions={{ exact: link.to === '/rsvp/manage' }}
            >
              {link.label}
            </Link>
          ))}
        </nav>
        <p className="mt-8 hidden text-sm text-[var(--text-faint)] md:block">
          DJ Piper P keeps the song requests with the wedding plan.
        </p>
      </aside>
      <div className="p-4 md:p-8">{children}</div>
    </div>
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
      <div className="mt-6 grid gap-3 sm:grid-cols-4">
        <Stat
          label="Attending"
          value={String(stats.attending)}
          hint={`of ${stats.guests} invited`}
        />
        <Stat label="Can't make it" value={String(stats.declined)} />
        <Stat
          label="Waiting on"
          value={String(stats.waitingGuests)}
          hint={`${stats.waitingParties} parties`}
        />
        <Stat
          label="RSVP deadline"
          value={data.deadlineLabel || '—'}
          hint={data.catererLabel ? `Caterer ${data.catererLabel}` : ''}
          pink
        />
      </div>
      <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <div className="flex justify-between text-sm">
          <span>Replies</span>
          <span>
            {replied} of {stats.guests} guests replied
          </span>
        </div>
        <div className="mt-3 flex h-2 overflow-hidden rounded-full bg-[var(--field)]">
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
      </section>
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-semibold">Latest replies</h2>
          <ul className="mt-3 grid gap-3">
            {stats.latest.map((party) => (
              <li
                key={party.partyId}
                className="flex items-center justify-between gap-3 text-sm"
              >
                <span>{party.name}</span>
                <span
                  className={
                    party.tone === 'no' ? 'text-rose-300' : 'text-emerald-300'
                  }
                >
                  {party.label}
                </span>
                <span className="text-[var(--text-faint)]">{party.ago}</span>
              </li>
            ))}
          </ul>
        </section>
        <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-semibold">By event</h2>
          <ul className="mt-3 grid gap-2 text-sm">
            {stats.byEvent.map((event) => (
              <li key={event.id} className="flex justify-between">
                <span>{event.name}</span>
                <span>{event.attending} attending</span>
              </li>
            ))}
          </ul>
          <h2 className="mt-4 font-semibold">Meals so far</h2>
          <p className="mt-2 text-sm text-[var(--text-muted)]">
            {stats.meals.length === 0
              ? 'No meals yet.'
              : stats.meals
                  .map((meal) => `${meal.label} ${meal.count}`)
                  .join(' · ')}
          </p>
        </section>
      </div>
    </div>
  )
}

function Stat({
  label,
  value,
  hint,
  pink,
}: {
  label: string
  value: string
  hint?: string
  pink?: boolean
}) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <p className="text-xs tracking-[0.14em] text-[var(--text-muted)]">
        {label.toUpperCase()}
      </p>
      <p
        className={`mt-2 text-3xl font-semibold ${pink ? 'text-[var(--pink)]' : ''}`}
      >
        {value}
      </p>
      {hint ? (
        <p className="mt-1 text-sm text-[var(--text-faint)]">{hint}</p>
      ) : null}
    </section>
  )
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
        <button
          type="button"
          className={`${rsvpButton} w-auto`}
          onClick={() => setEditing('new')}
        >
          + Add party
        </button>
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
            className={`min-h-11 rounded-full border px-3 text-sm ${filter === id ? 'border-[var(--pink)] text-white' : 'border-[var(--border-strong)] text-[var(--text-muted)]'}`}
            onClick={() => setFilter(id)}
          >
            {label}
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
              <span className="text-sm text-[var(--text-faint)]">
                {party.lastRepliedAt ? 'Replied' : 'Waiting'}
              </span>
            </button>
          </li>
        ))}
      </ul>
      {editing ? (
        <PartyDrawer
          party={current}
          events={data.wedding.events}
          error={error}
          onClose={() => setEditing(null)}
          onDelete={() => {
            if (!current) return
            void remove({ data: { id: current.id } }).then(() =>
              router.invalidate(),
            )
          }}
          onSave={(draft) => {
            setError('')
            void save({ data: draft }).then(async (result) => {
              if (!result.ok) {
                setError(
                  'error' in result
                    ? result.error
                    : 'Could not save that party.',
                )
                return
              }
              setEditing(null)
              await router.invalidate()
            })
          }}
        />
      ) : null}
    </div>
  )
}

function PartyDrawer({
  party,
  events,
  error,
  onClose,
  onSave,
  onDelete,
}: {
  party: ReadyManage['wedding']['parties'][number] | null
  events: ReadyManage['wedding']['events']
  error: string
  onClose: () => void
  onDelete: () => void
  onSave: (draft: Record<string, unknown>) => void
}) {
  const [name, setName] = useState(party?.name ?? '')
  const [email, setEmail] = useState(party?.email ?? '')
  const [plusOneAllowed, setPlus] = useState(party?.plusOneAllowed ?? false)
  const [eventIds, setEventIds] = useState<string[]>(
    party?.eventIds ?? events.map((event) => event.id),
  )
  const [guests, setGuests] = useState(
    party?.guests.map((guest) => ({
      id: guest.id,
      firstName: guest.firstName,
      lastName: guest.lastName,
      altNames: guest.altNames.join(', '),
      isChild: guest.isChild,
      isPlusOne: guest.isPlusOne,
    })) ?? [
      {
        id: '',
        firstName: '',
        lastName: '',
        altNames: '',
        isChild: false,
        isPlusOne: false,
      },
    ],
  )
  return (
    <div className="fixed inset-0 z-40 grid items-end bg-black/60 sm:items-center sm:justify-center">
      <form
        className="max-h-[90vh] w-full overflow-auto rounded-t-3xl bg-[var(--surface)] p-5 sm:max-w-lg sm:rounded-3xl"
        onSubmit={(event) => {
          event.preventDefault()
          onSave({
            id: party?.id ?? '',
            name,
            email,
            plusOneAllowed,
            eventIds,
            guests,
          })
        }}
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
          <button className={rsvpButton} type="submit">
            Save
          </button>
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

export function Events({ data }: { data: ReadyManage }) {
  const save = useServerFn(saveRsvpSetup)
  const router = useRouter()
  const [events, setEvents] = useState(data.wedding.events)
  const [deadline, setDeadline] = useState(data.wedding.deadline)
  const [caterer, setCaterer] = useState(data.wedding.catererDeadline)
  const [lockAfter, setLock] = useState(data.wedding.lockAfterDeadline)
  const [autoRemind, setRemind] = useState(data.wedding.autoRemind)
  const [options, setOptions] = useState(
    data.wedding.questions
      .find((question) => question.type === 'choice')
      ?.options.join(', ') ?? '',
  )
  const [notice, setNotice] = useState('')
  return (
    <form
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const questions = data.wedding.questions.map((question) =>
          question.type === 'choice'
            ? {
                ...question,
                options: options
                  .split(',')
                  .map((item) => item.trim())
                  .filter(Boolean),
              }
            : question,
        )
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
        {events.map((item) => (
          <li
            key={item.id}
            className="flex items-center justify-between rounded-2xl border border-[var(--border)] px-4 py-3"
          >
            <span>
              <span className="block font-semibold">{item.name}</span>
              <span className="text-sm text-[var(--text-muted)]">
                {item.time} · {item.location}
              </span>
            </span>
            <button
              type="button"
              aria-pressed={item.enabled}
              className="min-h-11 min-w-11 rounded-full bg-[var(--pink)] text-xs font-semibold text-[#0D0D0D]"
              onClick={() =>
                setEvents((current) =>
                  current.map((event) =>
                    event.id === item.id
                      ? { ...event, enabled: !event.enabled }
                      : event,
                  ),
                )
              }
            >
              {item.enabled ? 'On' : 'Off'}
            </button>
          </li>
        ))}
      </ul>
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
      <label className="text-sm" htmlFor="meals">
        Dinner options
        <input
          id="meals"
          className={`${rsvpField} mt-1`}
          value={options}
          onChange={(event) => setOptions(event.target.value)}
        />
      </label>
      <button className={`${rsvpButton} w-auto`} type="submit">
        Save changes
      </button>
      {notice ? (
        <p className="text-sm text-[var(--text-muted)]">{notice}</p>
      ) : null}
    </form>
  )
}

export function Songs({ data }: { data: ReadyManage }) {
  const save = useServerFn(saveSongStatus)
  const router = useRouter()
  const unique = useMemo(() => data.songs.length, [data.songs.length])
  const requests = data.songs.reduce((sum, song) => sum + song.count, 0)
  return (
    <div>
      <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
        SONG REQUESTS
      </p>
      <h1 className="portal-display text-4xl">
        {requests} requests · {unique} unique songs
      </h1>
      <p className="mt-2 text-sm text-[var(--text-muted)]">
        Mark any you never want played. Do-not-play stays off the dance floor.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full min-w-[640px] text-left text-sm">
          <thead className="text-[var(--text-faint)]">
            <tr>
              <th className="py-2">Song</th>
              <th>Artist</th>
              <th>Requests</th>
              <th>Requested by</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {data.songs.map((song, index) => (
              <tr
                key={`${song.title}-${song.artist}`}
                className="border-t border-[var(--border)]"
              >
                <td className="py-3 font-semibold">
                  {index + 1}. {song.title}
                </td>
                <td>{song.artist}</td>
                <td>{song.count}</td>
                <td>{song.who}</td>
                <td>
                  <button
                    type="button"
                    className="min-h-11 rounded-full border border-[var(--border-strong)] px-3"
                    onClick={() => {
                      const status =
                        song.status === 'queued'
                          ? 'must'
                          : song.status === 'must'
                            ? 'no'
                            : 'queued'
                      void save({
                        data: {
                          title: song.title,
                          artist: song.artist,
                          status,
                        },
                      }).then(() => router.invalidate())
                    }}
                  >
                    {song.status === 'must'
                      ? 'Must play'
                      : song.status === 'no'
                        ? 'Do not play'
                        : 'Queued'}
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

export function Exports({ data }: { data: ReadyManage }) {
  const load = useServerFn(downloadRsvpCsv)
  const today = data.wedding.eventDate || 'rsvp'
  async function grab(
    kind: 'caterer' | 'songs' | 'guests' | 'seating',
    name: string,
  ) {
    const body = await load({ data: { kind } })
    if (body)
      downloadText(`${name}-${today}.csv`, body, 'text/csv;charset=utf-8')
  }
  return (
    <div>
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
          title="Seating starter"
          body="Attending guests grouped by party, with children flagged"
          onClick={() => void grab('seating', 'seating')}
        />
      </div>
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        Still waiting on {data.stats.waitingParties} parties. Reminder emails
        stay on the desk so a click here does not send mail.
      </p>
    </div>
  )
}

function ExportCard({
  title,
  body,
  onClick,
}: {
  title: string
  body: string
  onClick: () => void
}) {
  return (
    <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="font-semibold">{title}</h2>
          <p className="mt-1 text-sm text-[var(--text-muted)]">{body}</p>
        </div>
        <button
          type="button"
          className="min-h-11 rounded-full border border-[var(--border-strong)] px-3 text-sm"
          onClick={onClick}
        >
          CSV
        </button>
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
  const [notice, setNotice] = useState('')
  const [copied, setCopied] = useState(false)
  return (
    <form
      className="grid max-w-xl gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        void save({
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
        }).then(async (result) => {
          setNotice(result.ok ? 'Saved.' : 'Could not save.')
          if (result.ok) await router.invalidate()
        })
      }}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
            SITE SETTINGS
          </p>
          <h1 className="portal-display text-4xl">Share & privacy</h1>
        </div>
        <button className={`${rsvpButton} w-auto`} type="submit">
          Save changes
        </button>
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
      <label className="text-sm" htmlFor="invite-code">
        Invite code
        <input
          id="invite-code"
          className={`${rsvpField} mt-1`}
          value={inviteCode}
          onChange={(event) => setCode(event.target.value)}
        />
      </label>
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
      {notice ? (
        <p className="text-sm text-[var(--text-muted)]">{notice}</p>
      ) : null}
    </form>
  )
}

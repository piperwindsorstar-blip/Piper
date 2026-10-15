import { Link, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import type { RsvpStatus } from '../../lib/rsvp/model.ts'
import {
  getRsvpCalendar,
  saveHouseholdReply,
} from '../../lib/rsvp/rsvp.functions.ts'
import type { getHousehold } from '../../lib/rsvp/rsvp.functions.ts'
import { ActionButton } from '../action-button.tsx'
import type { RunResult } from '../action-button.tsx'
import {
  Field,
  RsvpFrame,
  RsvpHeader,
  Steps,
  downloadText,
  rsvpButton,
  rsvpField,
  rsvpGhost,
} from './shell.tsx'
import { TheDay } from './timeline.tsx'

export type HouseholdData = NonNullable<
  Awaited<ReturnType<typeof getHousehold>>
>

function tallyGuests(
  events: { id: string }[],
  guests: { replies: Record<string, RsvpStatus | undefined> }[],
) {
  let attending = 0
  let declined = 0
  for (const guest of guests) {
    const coming = events.some(
      (event) => guest.replies[event.id] === 'attending',
    )
    const no = events.some((event) => guest.replies[event.id] === 'declined')
    if (coming) attending += 1
    else if (no) declined += 1
  }
  return { attending, declined }
}

export function HouseholdForm({ data }: { data: HouseholdData }) {
  const save = useServerFn(saveHouseholdReply)
  const router = useRouter()
  const [guests, setGuests] = useState(data.party.guests)
  const email = data.party.email
  const [error, setError] = useState('')

  const hosts = guests.filter((guest) => !guest.isPlusOne)
  const tally = tallyGuests(data.events, guests)
  const [plus, setPlus] = useState(() => initialPlus(data))

  function canBring(hostId: string) {
    const host = hosts.find((guest) => guest.id === hostId)
    if (!host) return false
    if (host.plusOneAllowed) return true
    if (!data.party.plusOneAllowed) return false
    if (hosts.some((guest) => guest.plusOneAllowed)) return false
    return hosts[0]?.id === hostId
  }

  function patch(final: boolean) {
    return {
      data: {
        slug: data.slug,
        token: data.party.token,
        email,
        note: data.party.note,
        final,
        guests: hosts.map((guest) => ({
          id: guest.id,
          replies: guest.replies,
          meal: guest.meal,
          dietary: guest.dietary,
          dietaryNote: guest.dietaryNote,
          song: guest.song,
          plusOneName: '',
        })),
        removePlusOneIds: [],
        addPlusOne: null,
        plusOnes: hosts.flatMap((guest) => {
          const draft = plus[guest.id]
          const coming = data.events.some(
            (event) => guest.replies[event.id] === 'attending',
          )
          if (!draft.bringing || !coming || !canBring(guest.id)) return []
          return [
            {
              id: draft.id,
              hostId: guest.id,
              name: draft.name,
              meal: draft.meal,
              dietaryNote: draft.dietaryNote,
            },
          ]
        }),
      },
    }
  }

  function setReply(id: string, eventId: string, status: RsvpStatus) {
    setGuests((current) =>
      current.map((guest) =>
        guest.id === id
          ? { ...guest, replies: { ...guest.replies, [eventId]: status } }
          : guest,
      ),
    )
  }

  return (
    <RsvpFrame>
      <RsvpHeader step="Step 2 of 3" />
      <Steps step={2} />
      <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
        REPLYING FOR
      </p>
      <h1 className="portal-display text-4xl">{data.party.name}</h1>
      <div className="mt-6 grid gap-4">
        {hosts.map((guest) => {
          const coming = data.events.some(
            (event) => guest.replies[event.id] === 'attending',
          )
          const mealEvent = data.events.some(
            (event) =>
              event.asksMeal && guest.replies[event.id] === 'attending',
          )
          return (
            <article
              key={guest.id}
              className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4"
            >
              <div className="flex items-center justify-between gap-3">
                {guest.isPlusOne ? (
                  <input
                    className={rsvpField}
                    aria-label="Plus-one name"
                    value={`${guest.firstName} ${guest.lastName}`.trim()}
                    onChange={(event) => {
                      const parts = event.target.value.trim().split(/\s+/)
                      const firstName = parts[0] ?? ''
                      const lastName = parts.slice(1).join(' ')
                      setGuests((current) =>
                        current.map((item) =>
                          item.id === guest.id
                            ? { ...item, firstName, lastName }
                            : item,
                        ),
                      )
                    }}
                  />
                ) : (
                  <h2 className="text-xl font-semibold">
                    {guest.firstName} {guest.lastName}
                  </h2>
                )}
                {guest.isChild ? (
                  <span className="rounded-full bg-amber-900/60 px-2 py-1 text-xs text-amber-200 [.light_&]:bg-amber-100 [.light_&]:text-amber-900">
                    Child
                  </span>
                ) : null}
                {guest.isPlusOne ? (
                  <span className="rounded-full bg-[var(--pink-tint)] px-2 py-1 text-xs text-[var(--pink-soft)]">
                    Plus-one
                  </span>
                ) : null}
              </div>
              {data.events.map((event) => (
                <fieldset key={event.id} className="mt-4">
                  <legend className="text-sm text-[var(--text-muted)]">
                    <span className="font-semibold text-[var(--text)]">
                      {event.name}
                    </span>
                    {eventWhen(event) ? (
                      <span className="block">{eventWhen(event)}</span>
                    ) : null}
                  </legend>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      aria-pressed={guest.replies[event.id] === 'attending'}
                      className={choiceClass(
                        guest.replies[event.id] === 'attending',
                      )}
                      onClick={() => setReply(guest.id, event.id, 'attending')}
                    >
                      Attending
                    </button>
                    <button
                      type="button"
                      aria-pressed={guest.replies[event.id] === 'declined'}
                      className={choiceClass(
                        guest.replies[event.id] === 'declined',
                        true,
                      )}
                      onClick={() => setReply(guest.id, event.id, 'declined')}
                    >
                      Can&apos;t make it
                    </button>
                  </div>
                </fieldset>
              ))}
              {mealEvent && !guest.isChild ? (
                <div className="mt-4">
                  <Field id={`${guest.id}-meal`} label="Dinner">
                    <select
                      id={`${guest.id}-meal`}
                      className={rsvpField}
                      value={guest.meal}
                      onChange={(event) =>
                        setGuests((current) =>
                          current.map((item) =>
                            item.id === guest.id
                              ? { ...item, meal: event.target.value }
                              : item,
                          ),
                        )
                      }
                    >
                      <option value="">Choose a meal</option>
                      {data.meals.map((meal) => (
                        <option key={meal} value={meal}>
                          {meal}
                        </option>
                      ))}
                    </select>
                  </Field>
                </div>
              ) : null}
              {coming ? (
                <fieldset className="mt-4">
                  <legend className="text-sm text-[var(--text-muted)]">
                    Dietary needs
                  </legend>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {data.dietary.map((diet) => {
                      const on = guest.dietary.includes(diet)
                      return (
                        <button
                          key={diet}
                          type="button"
                          aria-pressed={on}
                          className={`min-h-11 rounded-full border px-3 text-sm ${on ? 'border-[var(--pink)] text-[var(--pink-soft)]' : 'border-[var(--border-strong)] text-[var(--text-muted)]'}`}
                          onClick={() =>
                            setGuests((current) =>
                              current.map((item) =>
                                item.id === guest.id
                                  ? {
                                      ...item,
                                      dietary: on
                                        ? item.dietary.filter(
                                            (name) => name !== diet,
                                          )
                                        : [...item.dietary, diet],
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          {diet}
                        </button>
                      )
                    })}
                  </div>
                  <label
                    className="mt-3 block text-sm text-[var(--text-muted)]"
                    htmlFor={`${guest.id}-note`}
                  >
                    Anything else the caterer should know?
                  </label>
                  <textarea
                    id={`${guest.id}-note`}
                    className={`${rsvpField} mt-2 min-h-20 py-3`}
                    value={guest.dietaryNote}
                    onChange={(event) =>
                      setGuests((current) =>
                        current.map((item) =>
                          item.id === guest.id
                            ? { ...item, dietaryNote: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </fieldset>
              ) : null}
              {coming && data.song ? (
                <div className="mt-4">
                  <Field
                    id={`${guest.id}-song`}
                    label="What song gets you on the dance floor?"
                  >
                    <input
                      id={`${guest.id}-song`}
                      className={rsvpField}
                      placeholder="Song – Artist"
                      value={guest.song}
                      onChange={(event) =>
                        setGuests((current) =>
                          current.map((item) =>
                            item.id === guest.id
                              ? { ...item, song: event.target.value }
                              : item,
                          ),
                        )
                      }
                    />
                  </Field>
                </div>
              ) : null}
              {coming && canBring(guest.id) ? (
                <PlusOneFields
                  hostId={guest.id}
                  draft={
                    plus[guest.id] ?? {
                      bringing: false,
                      name: '',
                      meal: '',
                      dietaryNote: '',
                      id: '',
                    }
                  }
                  meals={data.meals}
                  onChange={(draft) =>
                    setPlus((current) => ({ ...current, [guest.id]: draft }))
                  }
                />
              ) : null}
            </article>
          )
        })}
      </div>
      {error ? (
        <p className="mt-4 text-sm text-[var(--pink-soft)]" role="alert">
          {error}
        </p>
      ) : null}
      <p className="mt-4 text-sm text-[var(--text-muted)]">
        {tally.attending} attending · {tally.declined} can&apos;t make it
      </p>
      <ActionButton
        className={`${rsvpButton} mt-3`}
        wrapperClassName="grid"
        busy="Saving…"
        done="Saved"
        surface="dark"
        disabled={data.locked}
        disabledHint="Replies are closed."
        onRun={async (): Promise<RunResult> => {
          const missing = hosts.find((guest) => {
            const draft = plus[guest.id]
            const coming = data.events.some(
              (event) => guest.replies[event.id] === 'attending',
            )
            if (!draft.bringing || !coming || !canBring(guest.id)) return false
            if (!draft.name.trim()) return true
            return data.meals.length > 0 && !draft.meal
          })
          if (missing) {
            const draft = plus[missing.id]
            const message = draft.name.trim()
              ? `Choose a meal for ${draft.name.trim().split(/\s+/)[0]}.`
              : "Enter the plus-one's name."
            setError(message)
            return { ok: false, message }
          }
          setError('')
          const result = await save(patch(false))
          if (!result.ok) {
            setError(result.error)
            return { ok: false, message: result.error }
          }
          await router.navigate({
            to: '/rsvp/$slug/p/$token/review',
            params: { slug: data.slug, token: data.party.token },
          })
          return { ok: true, message: 'Saved.' }
        }}
      >
        Review my RSVP →
      </ActionButton>
      <TheDay moments={data.day} />
    </RsvpFrame>
  )
}

type PlusDraft = {
  bringing: boolean
  name: string
  meal: string
  dietaryNote: string
  id: string
}

function initialPlus(data: HouseholdData): Record<string, PlusDraft> {
  const hosts = data.party.guests.filter((guest) => !guest.isPlusOne)
  const extras = data.party.guests.filter((guest) => guest.isPlusOne)
  const legacy =
    !hosts.some((guest) => guest.plusOneAllowed) && data.party.plusOneAllowed
  const first = hosts[0]?.id
  const state: Record<string, PlusDraft> = {}
  for (const host of hosts) {
    const existing =
      extras.find((guest) => guest.plusOneOf === host.id) ??
      (legacy && host.id === first
        ? extras.find((guest) => !guest.plusOneOf)
        : undefined)
    state[host.id] = existing
      ? {
          bringing: true,
          name: `${existing.firstName} ${existing.lastName}`.trim(),
          meal: existing.meal,
          dietaryNote: existing.dietaryNote,
          id: existing.id,
        }
      : { bringing: false, name: '', meal: '', dietaryNote: '', id: '' }
  }
  return state
}

function PlusOneFields({
  hostId,
  draft,
  meals,
  onChange,
}: {
  hostId: string
  draft: PlusDraft
  meals: string[]
  onChange: (draft: PlusDraft) => void
}) {
  return (
    <div className="mt-4 rounded-2xl border border-[var(--border)] p-3">
      <p className="text-sm font-semibold">Bringing a plus-one?</p>
      <div className="mt-2 grid grid-cols-2 gap-2">
        <button
          type="button"
          aria-pressed={draft.bringing}
          className={choiceClass(draft.bringing)}
          onClick={() => onChange({ ...draft, bringing: true })}
        >
          Yes
        </button>
        <button
          type="button"
          aria-pressed={!draft.bringing}
          className={choiceClass(!draft.bringing, true)}
          onClick={() => onChange({ ...draft, bringing: false })}
        >
          No
        </button>
      </div>
      {draft.bringing ? (
        <div className="mt-3 grid gap-3">
          <Field id={`${hostId}-plus-name`} label="Plus-one's name">
            <input
              id={`${hostId}-plus-name`}
              className={rsvpField}
              value={draft.name}
              onChange={(event) =>
                onChange({ ...draft, name: event.target.value })
              }
            />
          </Field>
          {meals.length > 0 ? (
            <Field id={`${hostId}-plus-meal`} label="Meal">
              <select
                id={`${hostId}-plus-meal`}
                className={rsvpField}
                value={draft.meal}
                onChange={(event) =>
                  onChange({ ...draft, meal: event.target.value })
                }
              >
                <option value="">Choose a meal</option>
                {meals.map((meal) => (
                  <option key={meal} value={meal}>
                    {meal}
                  </option>
                ))}
              </select>
            </Field>
          ) : null}
          <label
            className="text-sm text-[var(--text-muted)]"
            htmlFor={`${hostId}-plus-note`}
          >
            Dietary or allergy note
          </label>
          <textarea
            id={`${hostId}-plus-note`}
            className={`${rsvpField} min-h-20 py-3`}
            value={draft.dietaryNote}
            onChange={(event) =>
              onChange({ ...draft, dietaryNote: event.target.value })
            }
          />
        </div>
      ) : null}
    </div>
  )
}

function choiceClass(on: boolean, decline = false) {
  const base = 'min-h-12 rounded-2xl border text-sm font-semibold transition'
  if (!on) {
    return `${base} border-[var(--border-strong)] text-[var(--text-muted)]`
  }
  if (decline) {
    return `${base} border-rose-400 bg-rose-400/15 text-rose-200 [.light_&]:text-rose-800`
  }
  return `${base} border-emerald-400 bg-emerald-400/15 text-emerald-200 [.light_&]:text-emerald-800`
}

export function ReviewReply({ data }: { data: HouseholdData }) {
  const save = useServerFn(saveHouseholdReply)
  const router = useRouter()
  const [email, setEmail] = useState(data.party.email)
  const [note, setNote] = useState(data.party.note)
  const [error, setError] = useState('')

  return (
    <RsvpFrame>
      <RsvpHeader step="Step 3 of 3" />
      <Steps step={3} />
      <h1 className="portal-display text-4xl">Check your answers</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        You can change these until {data.deadline || 'the deadline'}.
      </p>
      <div className="mt-6 grid gap-4">
        {data.events.map((event) => (
          <section
            key={event.id}
            className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
                {event.name.toUpperCase()}
              </h2>
              <Link
                to="/rsvp/$slug/p/$token"
                params={{ slug: data.slug, token: data.party.token }}
                className="min-h-11 text-sm text-[var(--pink-soft)]"
              >
                Edit
              </Link>
            </div>
            <ul className="mt-3 grid gap-3">
              {data.party.guests.map((guest) => (
                <li
                  key={guest.id}
                  className="flex items-start justify-between gap-3"
                >
                  <span>
                    <span className="block font-semibold">
                      {guest.firstName} {guest.lastName}
                      {guest.isPlusOne ? ' (plus-one)' : ''}
                    </span>
                    <span className="text-sm text-[var(--text-muted)]">
                      {[guest.meal, ...guest.dietary, guest.song]
                        .filter(Boolean)
                        .join(' · ')}
                    </span>
                    {event.asksMeal &&
                    data.meals.length > 0 &&
                    guest.replies[event.id] === 'attending' &&
                    !guest.meal ? (
                      <span className="block text-sm font-semibold text-[var(--pink-soft)]">
                        No meal chosen yet. Tap Edit to pick one.
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={
                      guest.replies[event.id] === 'declined'
                        ? 'text-sm text-rose-300 [.light_&]:text-rose-700'
                        : 'text-sm text-emerald-300 [.light_&]:text-emerald-700'
                    }
                  >
                    {guest.replies[event.id] === 'declined'
                      ? "Can't make it"
                      : guest.replies[event.id] === 'attending'
                        ? 'Attending'
                        : 'Not yet'}
                  </span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => event.preventDefault()}
      >
        <Field id="confirm-email" label="Email for a confirmation (optional)">
          <input
            id="confirm-email"
            type="email"
            autoComplete="email"
            className={rsvpField}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <Field id="couple-note" label="Note to the couple (optional)">
          <input
            id="couple-note"
            className={rsvpField}
            value={note}
            onChange={(event) => setNote(event.target.value)}
          />
        </Field>
        {error ? (
          <p className="text-sm text-[var(--pink-soft)]" role="alert">
            {error}
          </p>
        ) : null}
        <SaveReply
          onRun={async () => {
            setError('')
            const result = await save({
              data: {
                slug: data.slug,
                token: data.party.token,
                email,
                note,
                final: true,
                guests: data.party.guests.map((guest) => ({
                  id: guest.id,
                  replies: guest.replies,
                  meal: guest.meal,
                  dietary: guest.dietary,
                  dietaryNote: guest.dietaryNote,
                  song: guest.song,
                  plusOneName: '',
                })),
                removePlusOneIds: [],
                addPlusOne: null,
              },
            })
            if (!result.ok) {
              // The button shows the reason; no second copy above it.
              return { ok: false, message: result.error }
            }
            // The reply is saved before any email goes out, so a missing
            // confirmation email never turns a sent RSVP into a failure.
            await router.navigate({
              to: '/rsvp/$slug/p/$token/done',
              params: { slug: data.slug, token: data.party.token },
              search: { sent: result.mailed ? '1' : '' },
            })
            return { ok: true, message: 'Sent.' }
          }}
        />
      </form>
    </RsvpFrame>
  )
}

function SaveReply({ onRun }: { onRun: () => Promise<RunResult> }) {
  return (
    <ActionButton
      className={rsvpButton}
      wrapperClassName="grid"
      busy="Sending…"
      done="Sent"
      surface="dark"
      onRun={onRun}
    >
      Send RSVP
    </ActionButton>
  )
}

export function ReplyDone({
  data,
  sent,
}: {
  data: HouseholdData
  sent: boolean
}) {
  const calendar = useServerFn(getRsvpCalendar)
  const tally = tallyGuests(data.events, data.party.guests)
  const songs = data.party.guests.filter((guest) => guest.song).length
  const maps = `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(
    [data.venue, data.address].filter(Boolean).join(', '),
  )}`
  return (
    <RsvpFrame>
      <RsvpHeader />
      <div className="mx-auto mt-6 grid h-16 w-16 place-items-center rounded-full border border-emerald-400 text-2xl text-emerald-300 [.light_&]:text-emerald-700">
        ✓
      </div>
      <h1 className="portal-display mt-4 text-center text-4xl">
        You&apos;re on the list!
      </h1>
      <p className="mt-3 text-center text-[var(--text-muted)]">
        Thanks, {data.party.guests[0]?.firstName || 'there'}. {data.couple} will
        see your reply right away.
        {sent && data.party.email
          ? ` A copy is on its way to ${data.party.email}.`
          : ''}
      </p>
      <section className="mt-6 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
        <p className="text-lg font-semibold">{tally.attending} attending</p>
        <p className="text-sm text-[var(--text-muted)]">
          {tally.declined} can&apos;t make it
          {songs > 0
            ? ` · ${songs} song request${songs === 1 ? '' : 's'} for DJ Piper P`
            : ''}
        </p>
      </section>
      <div className="mt-4 grid grid-cols-2 gap-2">
        <button
          type="button"
          className={rsvpGhost}
          onClick={() => {
            void calendar({
              data: { slug: data.slug, token: data.party.token },
            }).then((body) => {
              if (body) downloadText('wedding.ics', body, 'text/calendar')
            })
          }}
        >
          Add to calendar
        </button>
        <a className={rsvpGhost} href={maps}>
          Directions
        </a>
      </div>
      <Link
        to="/rsvp/$slug/p/$token"
        params={{ slug: data.slug, token: data.party.token }}
        className={`${rsvpGhost} mt-2`}
      >
        Change my reply
      </Link>
      <p className="mt-4 text-center text-sm text-[var(--text-faint)]">
        {sent
          ? 'The email also has a private link to change your reply later — no searching needed.'
          : 'To change your reply later, find your name on the invitation again, or keep this page.'}
      </p>
      <TheDay moments={data.day} />
    </RsvpFrame>
  )
}

/** "Sunday, June 13 · 9:00 AM · Brantford Golf" under an event's name. */
function eventWhen(event: {
  dateLabel?: string
  time: string
  location: string
}): string {
  return [event.dateLabel, event.time, event.location]
    .map((part) => (part ?? '').trim())
    .filter(Boolean)
    .join(' · ')
}

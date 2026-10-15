import { useServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import {
  LOCATION_MAX,
  MAX_MOMENTS,
  NOTE_MAX,
  TITLE_MAX,
  cleanTime,
  orderedMoments,
  sampleDay,
  sortMoments,
  timeLabel,
  validateTimeline,
} from '../../lib/rsvp/timeline.ts'
import type { GuestMoment, Moment, Timeline } from '../../lib/rsvp/timeline.ts'
import { saveRsvpTimeline } from '../../lib/rsvp/rsvp.functions.ts'
import type { getRsvpTimeline } from '../../lib/rsvp/rsvp.functions.ts'
import { SaveStatus, useAutosave } from './autosave.tsx'
import { PrintTimeline, usePrintSheet } from './print.tsx'
import { rsvpButton, rsvpGhost } from './shell.tsx'

export type TimelineData = NonNullable<
  Awaited<ReturnType<typeof getRsvpTimeline>>
>

const smallField =
  'min-h-11 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--field)] px-3 text-base text-[var(--text)] outline-none'
const iconButton =
  'grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] text-lg text-[var(--text-muted)] hover:border-[var(--pink)] hover:text-[var(--text)]'

let idCounter = 0
function newId(): string {
  idCounter += 1
  return `m-${Date.now().toString(36)}-${idCounter}`
}

/** Moments are only saved once each has a time and a title. */
function ready(moments: Moment[]): boolean {
  return moments.every((moment) => cleanTime(moment.time) && moment.title.trim())
}

/**
 * The couple's run of the day. Every change saves on its own once each moment
 * has a time and a title; there is no Save button to forget. A sample day is
 * the one exception: it stays a draft until the couple keeps it.
 */
export function TimelineEditor({ data }: { data: TimelineData }) {
  const save = useServerFn(saveRsvpTimeline)
  const [timeline, setTimeline] = useState<Timeline>(() => ({
    manualOrder: data.timeline.manualOrder,
    moments: orderedMoments(data.timeline),
  }))
  const [draft, setDraft] = useState(false)
  const [dragging, setDragging] = useState('')
  const [focusId, setFocusId] = useState('')
  /** The one moment open for editing; finished moments show as one line. */
  const [openId, setOpenId] = useState('')
  const { sheet, print } = usePrintSheet()
  const current = useRef(timeline)
  current.current = timeline
  // Re-sorting moves rows. Doing it while a finger or mouse button is down
  // would slide a different row under the click, so it waits for the release.
  const pointerDown = useRef(false)
  const sortPending = useRef(false)

  useEffect(() => {
    const down = () => {
      pointerDown.current = true
    }
    const up = () => {
      pointerDown.current = false
      if (!sortPending.current) return
      sortPending.current = false
      // After the click this release belongs to has landed.
      window.setTimeout(() => sortNow(), 0)
    }
    document.addEventListener('pointerdown', down, true)
    document.addEventListener('pointerup', up, true)
    document.addEventListener('pointercancel', up, true)
    return () => {
      document.removeEventListener('pointerdown', down, true)
      document.removeEventListener('pointerup', up, true)
      document.removeEventListener('pointercancel', up, true)
    }
  })

  function sortNow() {
    const now = current.current
    if (now.manualOrder) return
    const sorted = sortMoments(now.moments)
    if (sorted.every((moment, index) => moment === now.moments[index])) return
    const next = { ...now, moments: sorted }
    current.current = next
    setTimeline(next)
  }

  function sortSoon() {
    if (pointerDown.current) sortPending.current = true
    else sortNow()
  }

  async function send(next: Timeline) {
    const checked = validateTimeline(next)
    if (!checked.ok) return checked
    const result = await save({
      data: { moments: next.moments, manualOrder: next.manualOrder },
    })
    if (!result.ok) return { ok: false as const, error: result.error }
    setDraft(false)
    return { ok: true as const }
  }

  const autosave = useAutosave<Timeline>(send)

  /** Applies a change; sorts by time unless the couple set their own order. */
  function commit(next: Timeline, opts: { resort?: boolean } = {}) {
    const shaped = {
      ...next,
      moments:
        opts.resort && !next.manualOrder
          ? sortMoments(next.moments)
          : next.moments,
    }
    current.current = shaped
    setTimeline(shaped)
    if (draft) return
    if (ready(shaped.moments)) autosave.schedule(shaped)
  }

  function patch(id: string, change: Partial<Moment>, resort = false) {
    commit(
      {
        ...current.current,
        moments: current.current.moments.map((moment) =>
          moment.id === id ? { ...moment, ...change } : moment,
        ),
      },
      { resort },
    )
  }

  function move(fromId: string, toId: string) {
    if (fromId === toId) return
    const list = current.current.moments.slice()
    const from = list.findIndex((moment) => moment.id === fromId)
    const to = list.findIndex((moment) => moment.id === toId)
    if (from < 0 || to < 0) return
    const [item] = list.splice(from, 1)
    if (!item) return
    list.splice(to, 0, item)
    commit({ moments: list, manualOrder: true })
  }

  const visible = timeline.moments.filter((moment) => moment.guests).length

  return (
    <div>
      <div className="max-w-3xl print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
              TIMELINE
            </p>
            <h1 className="portal-display text-4xl">The day</h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              {timeline.moments.length === 0
                ? 'Add the moments of your day. Guests see the ones you share.'
                : `${timeline.moments.length} moment${timeline.moments.length === 1 ? '' : 's'} · ${visible} shown to guests`}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            {!draft && !ready(timeline.moments) ? (
              <span className="text-sm text-[var(--text-muted)]">
                Add a time and a title to every moment to save.
              </span>
            ) : (
              <SaveStatus phase={autosave.phase} error={autosave.error} />
            )}
            {timeline.moments.length > 0 ? (
              <button
                type="button"
                className={`${rsvpGhost} w-auto`}
                onClick={() => print('timeline')}
              >
                Print / PDF
              </button>
            ) : null}
          </div>
        </div>

        {draft ? (
          <p
            className="mt-4 rounded-2xl border border-[var(--pink)] bg-[var(--pink-tint)] px-4 py-3 text-sm text-[var(--text)]"
            role="status"
          >
            This is a sample day for you to edit. Nothing is saved until you
            keep it.
            <span className="mt-3 flex flex-wrap gap-2">
              <button
                type="button"
                className={`${rsvpButton} w-auto`}
                onClick={() => {
                  if (!ready(current.current.moments)) {
                    autosave.hold(
                      'Add a time and a title to every moment first.',
                    )
                    return
                  }
                  setDraft(false)
                  autosave.flush(current.current)
                }}
              >
                Keep this day
              </button>
              <button
                type="button"
                className={`${rsvpGhost} w-auto`}
                onClick={() => {
                  const empty = { manualOrder: false, moments: [] }
                  current.current = empty
                  setTimeline(empty)
                  setDraft(false)
                }}
              >
                Discard sample
              </button>
            </span>
          </p>
        ) : null}

        <div className="mt-4 flex flex-wrap gap-2">
          {timeline.moments.length === 0 || draft ? null : (
            <button
              type="button"
              className={`${rsvpGhost} w-auto`}
              disabled={!timeline.manualOrder}
              onClick={() =>
                commit(
                  { ...current.current, manualOrder: false },
                  { resort: true },
                )
              }
            >
              {timeline.manualOrder ? 'Sort by time' : 'Sorted by time'}
            </button>
          )}
          {timeline.moments.length === 0 ? (
            <button
              type="button"
              className={`${rsvpGhost} w-auto`}
              onClick={() => {
                const sample = { manualOrder: false, moments: sampleDay(newId) }
                current.current = sample
                setTimeline(sample)
                setDraft(true)
              }}
            >
              Start from a sample day
            </button>
          ) : null}
        </div>

        <ol className="mt-4 grid grid-cols-[minmax(0,1fr)] gap-3">
          {timeline.moments.map((moment, index) => {
            const time = cleanTime(moment.time)
            const complete = Boolean(time && moment.title.trim())
            if (complete && openId !== moment.id) {
              return (
                <li key={moment.id}>
                  <button
                    type="button"
                    className="flex min-h-14 w-full items-center gap-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] px-4 py-3 text-left hover:border-[var(--border-strong)]"
                    aria-label={`Edit ${moment.title} at ${timeLabel(time)}`}
                    onClick={() => setOpenId(moment.id)}
                  >
                    <span className="w-[4.75rem] shrink-0 text-sm font-semibold text-[var(--pink-soft)]">
                      {timeLabel(time)}
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-semibold">{moment.title}</span>
                      {moment.location || moment.note ? (
                        <span className="block truncate text-sm text-[var(--text-muted)]">
                          {[moment.location, moment.note].filter(Boolean).join(' · ')}
                        </span>
                      ) : null}
                    </span>
                    {moment.guests ? null : (
                      <span className="shrink-0 rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                        Private
                      </span>
                    )}
                    <span className="shrink-0 text-sm text-[var(--text-muted)] underline">Edit</span>
                  </button>
                </li>
              )
            }
            return (
              <li
                key={moment.id}
                className={`rounded-3xl border bg-[var(--surface)] p-3 ${dragging === moment.id ? 'border-[var(--pink)] opacity-60' : 'border-[var(--border)]'}`}
                onDragOver={(event) => {
                  if (!dragging) return
                  event.preventDefault()
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  if (dragging) move(dragging, moment.id)
                  setDragging('')
                }}
              >
                <div className="flex items-start gap-2">
                  <div className="flex flex-col items-center gap-1 pt-1">
                    <span
                      className="grid h-11 w-8 cursor-grab place-items-center text-xl text-[var(--text-faint)]"
                      draggable
                      aria-hidden="true"
                      title="Drag to reorder"
                      onDragStart={(event) => {
                        event.dataTransfer.setData('text/plain', moment.id)
                        event.dataTransfer.effectAllowed = 'move'
                        setDragging(moment.id)
                      }}
                      onDragEnd={() => setDragging('')}
                    >
                      ⋮⋮
                    </span>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full text-sm text-[var(--text-muted)] disabled:opacity-30"
                      aria-label={`Move ${moment.title || 'moment'} up`}
                      disabled={index === 0}
                      onClick={() => {
                        const before = timeline.moments[index - 1]
                        if (before) move(moment.id, before.id)
                      }}
                    >
                      ↑
                    </button>
                    <button
                      type="button"
                      className="h-8 w-8 rounded-full text-sm text-[var(--text-muted)] disabled:opacity-30"
                      aria-label={`Move ${moment.title || 'moment'} down`}
                      disabled={index === timeline.moments.length - 1}
                      onClick={() => {
                        const after = timeline.moments[index + 1]
                        if (after) move(after.id, moment.id)
                      }}
                    >
                      ↓
                    </button>
                  </div>
                  <div className="grid min-w-0 flex-1 gap-2 sm:grid-cols-[8.5rem_minmax(0,1fr)]">
                    <label className="text-sm">
                      Time
                      <input
                        type="time"
                        required
                        className={`${smallField} mt-1`}
                        value={time}
                        aria-invalid={!time ? true : undefined}
                        onChange={(event) =>
                          patch(moment.id, { time: event.target.value })
                        }
                        onBlur={sortSoon}
                      />
                    </label>
                    <label className="text-sm">
                      Title
                      <input
                        required
                        maxLength={TITLE_MAX}
                        className={`${smallField} mt-1`}
                        placeholder="Ceremony"
                        value={moment.title}
                        autoFocus={focusId === moment.id}
                        aria-invalid={!moment.title.trim() ? true : undefined}
                        onChange={(event) =>
                          patch(moment.id, { title: event.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      Location{' '}
                      <span className="text-[var(--text-faint)]">
                        (blank means {data.venue || 'the venue'})
                      </span>
                      <input
                        maxLength={LOCATION_MAX}
                        className={`${smallField} mt-1`}
                        placeholder={data.venue || 'The venue'}
                        value={moment.location}
                        onChange={(event) =>
                          patch(moment.id, { location: event.target.value })
                        }
                      />
                    </label>
                    <label className="text-sm sm:col-span-2">
                      Note{' '}
                      <span className="text-[var(--text-faint)]">(optional)</span>
                      <input
                        maxLength={NOTE_MAX}
                        className={`${smallField} mt-1`}
                        placeholder="Doors open at 3:30"
                        value={moment.note}
                        onChange={(event) =>
                          patch(moment.id, { note: event.target.value })
                        }
                      />
                    </label>
                    <label className="flex min-h-11 items-center gap-2 text-sm sm:col-span-2">
                      <input
                        type="checkbox"
                        checked={moment.guests}
                        onChange={(event) =>
                          patch(moment.id, { guests: event.target.checked })
                        }
                      />
                      Show to guests
                      {!moment.guests ? (
                        <span className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
                          Private · you and the DJ only
                        </span>
                      ) : null}
                    </label>
                    {complete ? (
                      <button
                        type="button"
                        className={`${rsvpGhost} w-auto justify-self-start sm:col-span-2`}
                        onClick={() => {
                          setOpenId('')
                          sortSoon()
                        }}
                      >
                        Done
                      </button>
                    ) : null}
                  </div>
                  <button
                    type="button"
                    className={iconButton}
                    aria-label={`Remove ${moment.title || 'this moment'}`}
                    onClick={() => {
                      const name = moment.title.trim()
                        ? `"${moment.title.trim()}"${time ? ` at ${timeLabel(time)}` : ''}`
                        : 'this moment'
                      if (!window.confirm(`Remove ${name}?`)) return
                      const moments = current.current.moments.filter(
                        (item) => item.id !== moment.id,
                      )
                      const next = { ...current.current, moments }
                      current.current = next
                      setTimeline(next)
                      if (!draft && ready(moments)) autosave.flush(next)
                    }}
                  >
                    ×
                  </button>
                </div>
              </li>
            )
          })}
        </ol>

        <div className="mt-4 flex flex-wrap items-start gap-3">
          <button
            type="button"
            className={`${rsvpGhost} w-auto`}
            disabled={timeline.moments.length >= MAX_MOMENTS}
            onClick={() => {
              const id = newId()
              setFocusId(id)
              setOpenId(id)
              const next = {
                ...current.current,
                moments: [
                  ...current.current.moments,
                  {
                    id,
                    time: '',
                    title: '',
                    location: '',
                    note: '',
                    guests: true,
                  },
                ],
              }
              current.current = next
              setTimeline(next)
            }}
          >
            + Add moment
          </button>
          <span className="flex min-h-11 items-center gap-3 text-sm text-[var(--text-muted)]">
            {draft ? null : 'Changes save on their own.'}
            {!draft && ready(timeline.moments) ? (
              <SaveStatus phase={autosave.phase} error={autosave.error} />
            ) : null}
          </span>
        </div>
      </div>
      {sheet === 'timeline' ? (
        <div className="hidden print:block">
          <PrintTimeline
            timeline={timeline}
            venue={data.venue}
            couple={data.couple}
            dateLabel={data.dateLabel}
          />
        </div>
      ) : null}
    </div>
  )
}

/**
 * "The day" on the guest pages: the shared moments as a vertical timeline in
 * the couple's template colours and display face. Shown only once there is at
 * least one moment for guests.
 */
export function TheDay({ moments }: { moments: GuestMoment[] }) {
  if (moments.length === 0) return null
  return (
    <section className="mt-8" aria-labelledby="the-day">
      <h2
        id="the-day"
        className="text-xs tracking-[0.18em] text-[var(--text-muted)]"
      >
        THE DAY
      </h2>
      <ol className="relative mt-4 grid gap-5 pl-7">
        <span
          aria-hidden="true"
          className="absolute bottom-2 left-[7px] top-2 w-px bg-[var(--border-strong)]"
        />
        {moments.map((moment) => (
          <li key={moment.id} className="relative">
            <span
              aria-hidden="true"
              className="absolute -left-7 top-1.5 h-[15px] w-[15px] rounded-full border-2 border-[var(--pink)] bg-[var(--surface)]"
            />
            <p className="text-sm font-semibold tracking-wide text-[var(--pink-soft)]">
              {moment.time}
            </p>
            <p className="portal-display mt-0.5 text-2xl leading-tight">
              {moment.title}
            </p>
            {moment.location ? (
              <p className="mt-0.5 text-sm text-[var(--text-muted)]">
                {moment.location}
              </p>
            ) : null}
            {moment.note ? (
              <p className="mt-1 text-sm text-[var(--text-faint)]">
                {moment.note}
              </p>
            ) : null}
          </li>
        ))}
      </ol>
    </section>
  )
}

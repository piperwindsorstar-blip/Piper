import { useState } from 'react'
import type {
  AppearanceRole,
  Planning,
  SongItem,
} from '../../lib/crm/planning.ts'
import { itemAt, linkPlatform, textValue } from '../../lib/portal/questions.ts'
import type { Question } from '../../lib/portal/questions.ts'
import { usePortal } from './portal-state.tsx'

const ROLES: Array<{ value: AppearanceRole; label: string }> = [
  { value: 'entrance', label: 'Grand entrance' },
  { value: 'speech', label: 'Speech' },
  { value: 'dance', label: 'Dance' },
  { value: 'other', label: 'Other' },
]

export function QuestionControl({ question }: { question: Question }) {
  const portal = usePortal()
  const disabled = portal.locked
  if (question.type === 'choice')
    return <Choice question={question} disabled={disabled} />
  if (question.type === 'chips') return <Chips disabled={disabled} />
  if (question.type === 'song')
    return <Song question={question} disabled={disabled} />
  if (question.type === 'list' && question.id === 'appearances') {
    return <Appearances disabled={disabled} />
  }
  if (question.type === 'list') {
    return (
      <SongList
        id={question.id === 'doNotPlay' ? 'doNotPlay' : 'mustPlay'}
        disabled={disabled}
      />
    )
  }
  if (question.type === 'textarea' || question.id === 'receptionAddress') {
    return <Lines question={question} disabled={disabled} />
  }
  return <Line question={question} disabled={disabled} />
}

function Line({
  question,
  disabled,
}: {
  question: Question
  disabled: boolean
}) {
  const { page, planning, editText } = usePortal()
  const value = textValue(planning, question.id)
  const shown =
    question.type === 'date' &&
    !/^\d{4}-\d{2}-\d{2}$/.test(value) &&
    /^\d{4}-\d{2}-\d{2}$/.test(page.eventDate)
      ? page.eventDate
      : isoOrBlank(question, value)
  const inputType =
    question.type === 'email'
      ? 'email'
      : question.type === 'phone'
        ? 'tel'
        : question.type === 'number'
          ? 'number'
          : question.type === 'date'
            ? 'date'
            : question.type === 'url'
              ? 'url'
              : 'text'
  return (
    <div>
      <label className="block">
        <span className="sr-only">{question.label}</span>
        <input
          className="portal-input"
          type={inputType}
          inputMode={question.type === 'number' ? 'numeric' : undefined}
          min={question.type === 'number' ? 0 : undefined}
          value={shown}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value
            if (question.type === 'number' && next !== '' && Number(next) < 0)
              return
            editText(question.id, next)
          }}
        />
      </label>
      {question.type === 'url' ? <Platform value={value} /> : null}
    </div>
  )
}

function Lines({
  question,
  disabled,
}: {
  question: Question
  disabled: boolean
}) {
  const { planning, editText, editSameReception } = usePortal()
  const value = textValue(planning, question.id)
  return (
    <div>
      {question.id === 'receptionAddress' ? (
        <label className="mb-3 flex min-h-11 items-center gap-3 text-sm text-[var(--text-muted)]">
          <input
            type="checkbox"
            checked={planning.receptionSame}
            disabled={disabled}
            onChange={(event) => editSameReception(event.target.checked)}
          />
          Same as ceremony
        </label>
      ) : null}
      <label className="block">
        <span className="sr-only">{question.label}</span>
        <textarea
          className="portal-input min-h-32 py-4"
          rows={4}
          value={value}
          disabled={
            disabled ||
            (question.id === 'receptionAddress' && planning.receptionSame)
          }
          onChange={(event) => editText(question.id, event.target.value)}
        />
      </label>
    </div>
  )
}

function Choice({
  question,
  disabled,
}: {
  question: Question
  disabled: boolean
}) {
  const { planning, editText } = usePortal()
  const value = textValue(planning, question.id)
  const known = question.options?.some((option) => option.value === value)
  return (
    <fieldset>
      <legend className="sr-only">{question.label}</legend>
      <div className="grid gap-3 min-[1024px]:grid-cols-3">
        {question.options?.map((option) => {
          const selected = value === option.value
          return (
            <label
              key={option.value}
              className={`min-h-[64px] cursor-pointer rounded-[18px] border-2 px-4 py-4 ${
                selected
                  ? 'border-[var(--pink)] bg-[var(--pink-tint)]'
                  : 'border-[var(--border-strong)] bg-[var(--field)]'
              }`}
            >
              <input
                className="sr-only"
                type="radio"
                name={question.id}
                value={option.value}
                checked={selected}
                disabled={disabled}
                onChange={() => editText(question.id, option.value)}
              />
              <span className="block text-lg font-bold">{option.value}</span>
              <span
                className={`mt-1 block text-sm ${selected ? 'text-[var(--pink-soft)]' : 'text-[var(--text-muted)]'}`}
              >
                {option.hint}
              </span>
            </label>
          )
        })}
      </div>
      {!known && value.trim() ? (
        <p className="mt-3 text-sm text-[var(--text-muted)]">
          Saved note: {value}
        </p>
      ) : null}
    </fieldset>
  )
}

function Chips({ disabled }: { disabled: boolean }) {
  const { planning, editChips, editText } = usePortal()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const options = [
    'Throwbacks',
    'Country',
    'Top 40',
    'R&B',
    'Motown',
    'Rock',
    'Latin',
    'Hip hop',
    'Chill dinner',
    'Full party',
    ...planning.genreChips.filter(
      (chip) =>
        ![
          'Throwbacks',
          'Country',
          'Top 40',
          'R&B',
          'Motown',
          'Rock',
          'Latin',
          'Hip hop',
          'Chill dinner',
          'Full party',
        ].includes(chip),
    ),
  ]
  function toggle(chip: string) {
    const next = planning.genreChips.includes(chip)
      ? planning.genreChips.filter((item) => item !== chip)
      : [...planning.genreChips, chip]
    editChips(next)
  }
  return (
    <div>
      <div className="flex flex-wrap gap-2">
        {options.map((chip) => {
          const selected = planning.genreChips.includes(chip)
          return (
            <button
              key={chip}
              type="button"
              disabled={disabled}
              aria-pressed={selected}
              className={`min-h-11 rounded-full px-4 text-sm font-semibold ${
                selected
                  ? 'bg-[var(--pink)] text-[#0d0d0d]'
                  : 'border border-[var(--border-strong)] text-white'
              }`}
              onClick={() => toggle(chip)}
            >
              {chip}
            </button>
          )
        })}
        {adding ? (
          <input
            className="portal-input min-h-11 w-40"
            value={draft}
            disabled={disabled}
            aria-label="Your own vibe"
            onChange={(event) => setDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return
              event.preventDefault()
              const next = draft.trim()
              if (!next) return
              editChips([...planning.genreChips, next])
              setDraft('')
              setAdding(false)
            }}
          />
        ) : (
          <button
            type="button"
            disabled={disabled}
            className="min-h-11 rounded-full border border-[var(--border-strong)] px-4 text-sm"
            onClick={() => setAdding(true)}
          >
            + Add your own
          </button>
        )}
      </div>
      <label className="mt-4 block">
        <span className="sr-only">In your own words</span>
        <textarea
          className="portal-input min-h-28 py-4"
          rows={3}
          placeholder="Romantic at dinner, packed dance floor after nine..."
          value={planning.genres}
          disabled={disabled}
          onChange={(event) => editText('genres', event.target.value)}
        />
      </label>
    </div>
  )
}

function Song({
  question,
  disabled,
}: {
  question: Question
  disabled: boolean
}) {
  const { planning, editTimeline } = usePortal()
  const index = question.timelineIndex ?? 0
  const row = itemAt(planning.timeline, index)
  if (!row) return null
  const platform = linkPlatform(row.link)
  const picked = Boolean(
    row.song.trim() || row.artist.trim() || row.link.trim(),
  )
  return (
    <div>
      {/* TODO: connect a real song search API. Pasting a link works today. */}
      <label className="block">
        <span className="sr-only">Song or link</span>
        <input
          className="portal-input"
          placeholder="Search a song or paste a link"
          value={row.link}
          disabled={disabled}
          onChange={(event) =>
            editTimeline(index, { link: event.target.value })
          }
        />
      </label>
      {row.link.trim() ? <Platform value={row.link} /> : null}
      {picked ? (
        <div className="mt-4 flex items-center gap-4 rounded-[18px] border-2 border-[var(--pink)] bg-[var(--pink-tint)] p-3">
          <span className="grid h-[60px] w-[60px] shrink-0 place-items-center rounded-2xl bg-[#0d0d0d] text-[var(--pink)]">
            <MusicIcon />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate font-bold">
              {row.song.trim() || 'Song title'}
            </span>
            <span className="block truncate text-sm text-[var(--pink-soft)]">
              {[row.artist.trim() || 'Artist', platform]
                .filter(Boolean)
                .join(' · ')}
            </span>
          </span>
          <span className="text-sm text-[var(--pink-soft)]">Selected</span>
        </div>
      ) : null}
      <div className="mt-4 grid gap-3 min-[1024px]:grid-cols-2">
        <label>
          <span className="sr-only">Song title</span>
          <input
            className="portal-input"
            placeholder="Song title"
            value={row.song}
            disabled={disabled}
            onChange={(event) =>
              editTimeline(index, { song: event.target.value })
            }
          />
        </label>
        <label>
          <span className="sr-only">Artist</span>
          <input
            className="portal-input"
            placeholder="Artist"
            value={row.artist}
            disabled={disabled}
            onChange={(event) =>
              editTimeline(index, { artist: event.target.value })
            }
          />
        </label>
        <label>
          <span className="sr-only">Time</span>
          <input
            className="portal-input"
            placeholder="Time: 6:10 pm"
            value={row.time}
            disabled={disabled}
            onChange={(event) =>
              editTimeline(index, { time: event.target.value })
            }
          />
        </label>
        <label>
          <span className="sr-only">Notes</span>
          <input
            className="portal-input"
            placeholder="Notes: start at, fade out, special edit..."
            value={row.notes}
            disabled={disabled}
            onChange={(event) =>
              editTimeline(index, { notes: event.target.value })
            }
          />
        </label>
      </div>
      <label className="mt-4 block">
        <span className="sr-only">Rename this moment</span>
        <input
          className="portal-input"
          placeholder={`Rename this moment (${row.activity})`}
          value={row.label}
          disabled={disabled}
          onChange={(event) =>
            editTimeline(index, { label: event.target.value })
          }
        />
      </label>
      <div className="mt-4 flex flex-wrap gap-3">
        <button
          type="button"
          className="min-h-11 text-sm text-[var(--text-muted)] underline"
          disabled={disabled}
          onClick={() => editTimeline(index, { hidden: !row.hidden })}
        >
          {row.hidden ? 'Show this moment' : 'Hide this moment'}
        </button>
        <button
          type="button"
          className="min-h-11 text-sm text-[var(--text-muted)] underline"
          disabled={disabled || planning.timeline.length >= 30}
          onClick={() =>
            editTimeline(planning.timeline.length, {
              time: '',
              section: row.section,
              activity: 'Added moment',
              song: '',
              artist: '',
              notes: '',
              link: '',
              hidden: false,
              label: '',
            })
          }
        >
          Add a moment
        </button>
      </div>
    </div>
  )
}

function SongList({
  id,
  disabled,
}: {
  id: 'mustPlay' | 'doNotPlay'
  disabled: boolean
}) {
  const { planning, editSongs } = usePortal()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [editing, setEditing] = useState<number | null>(null)
  const items =
    id === 'mustPlay'
      ? songsOrLegacy(planning.mustPlayItems, planning.mustPlay)
      : songsOrLegacy(planning.doNotPlayItems, planning.doNotPlay)
  function update(next: SongItem[]) {
    editSongs(id, next)
  }
  return (
    <div className="grid gap-3">
      {items.map((item, index) => {
        const open = editing === index || !item.song.trim()
        return (
          <article
            key={index}
            draggable={!disabled}
            onDragStart={() => setDragIndex(index)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={() => {
              if (dragIndex === null) return
              update(reorder(items, dragIndex, index))
              setDragIndex(null)
            }}
            className="rounded-[18px] bg-[var(--field)] p-4"
          >
            <div className="flex items-start gap-3">
              <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[var(--pink)] text-sm font-bold text-[#0d0d0d]">
                {index + 1}
              </span>
              {open ? (
                <div className="min-w-0 flex-1">
                  <input
                    className="w-full bg-transparent font-bold outline-none"
                    aria-label={`Song ${index + 1}`}
                    value={item.song}
                    disabled={disabled}
                    placeholder="Song"
                    onChange={(event) =>
                      update(
                        items.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, song: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  <input
                    className="mt-1 w-full bg-transparent text-sm text-[var(--text-muted)] outline-none"
                    aria-label={`Artist ${index + 1}`}
                    value={item.artist}
                    disabled={disabled}
                    placeholder="Artist"
                    onChange={(event) =>
                      update(
                        items.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, artist: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                  <input
                    className="mt-1 w-full bg-transparent text-sm text-[var(--text-muted)] outline-none"
                    aria-label={`Link ${index + 1}`}
                    value={item.link}
                    disabled={disabled}
                    placeholder="Link"
                    onChange={(event) =>
                      update(
                        items.map((row, rowIndex) =>
                          rowIndex === index
                            ? { ...row, link: event.target.value }
                            : row,
                        ),
                      )
                    }
                  />
                </div>
              ) : (
                <div className="min-w-0 flex-1">
                  <p className="font-bold">{item.song}</p>
                  <p className="text-sm text-[var(--text-muted)]">
                    {item.artist || 'Artist'}
                  </p>
                  <button
                    type="button"
                    className="mt-1 min-h-11 text-sm underline"
                    onClick={() => setEditing(index)}
                  >
                    Edit
                  </button>
                </div>
              )}
              <div className="flex gap-2">
                <button
                  type="button"
                  className="min-h-11 text-sm"
                  aria-label={`Move song ${index + 1} up`}
                  disabled={disabled || index === 0}
                  onClick={() => update(move(items, index, -1))}
                >
                  Up
                </button>
                <button
                  type="button"
                  className="min-h-11 text-sm"
                  aria-label={`Move song ${index + 1} down`}
                  disabled={disabled || index === items.length - 1}
                  onClick={() => update(move(items, index, 1))}
                >
                  Down
                </button>
              </div>
            </div>
          </article>
        )
      })}
      <button
        type="button"
        disabled={disabled}
        className="min-h-11 text-left text-sm text-[var(--text-muted)]"
        onClick={() => update([...items, { song: '', artist: '', link: '' }])}
      >
        + Add a song
      </button>
    </div>
  )
}

function Appearances({ disabled }: { disabled: boolean }) {
  const { planning, editAppearances } = usePortal()
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const rows = planning.appearances.filter(
    (row) => row.names || row.people || row.when || row.notes || row.role,
  )
  const groups = [
    { role: 'entrance' as const, title: 'Grand entrance' },
    { role: 'speech' as const, title: 'Speeches' },
    { role: 'dance' as const, title: 'Dances & special moments' },
    { role: 'other' as const, title: 'Other' },
    { role: '' as const, title: 'Still to place' },
  ]
  function update(next: Planning['appearances']) {
    editAppearances(next)
  }
  return (
    <div className="grid gap-6">
      {groups.map((group) => {
        const inGroup = rows
          .map((row, index) => ({ row, index }))
          .filter((item) => (item.row.role || '') === group.role)
        if (group.role === '' && inGroup.length === 0) return null
        return (
          <section key={group.role || 'open'}>
            <h3 className="text-[11px] font-bold tracking-[0.16em] text-[var(--pink)] uppercase">
              {group.title}
            </h3>
            <div className="mt-3 grid gap-3">
              {inGroup.map(({ row, index }) => (
                <article
                  key={index}
                  draggable={!disabled}
                  onDragStart={() => setDragIndex(index)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => {
                    if (dragIndex === null) return
                    update(reorder(rows, dragIndex, index))
                    setDragIndex(null)
                  }}
                  className="rounded-[18px] bg-[var(--field)] p-4"
                >
                  <div className="flex gap-3">
                    <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[var(--pink)] text-sm font-bold text-[#0d0d0d]">
                      {index + 1}
                    </span>
                    <div className="grid min-w-0 flex-1 gap-2">
                      <input
                        className="bg-transparent font-bold outline-none"
                        aria-label="Names or group"
                        value={row.names}
                        disabled={disabled}
                        placeholder="Names or group"
                        onChange={(event) =>
                          update(
                            rows.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, names: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <input
                        className="bg-transparent text-sm text-[var(--text-muted)] outline-none"
                        aria-label="People"
                        value={row.people}
                        disabled={disabled}
                        placeholder="People"
                        onChange={(event) =>
                          update(
                            rows.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, people: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <input
                        className="bg-transparent text-sm text-[var(--text-muted)] outline-none"
                        aria-label="When it happens"
                        value={row.when}
                        disabled={disabled}
                        placeholder="When it happens"
                        onChange={(event) =>
                          update(
                            rows.map((item, itemIndex) =>
                              itemIndex === index
                                ? { ...item, when: event.target.value }
                                : item,
                            ),
                          )
                        }
                      />
                      <label className="text-sm text-[var(--text-muted)]">
                        Role
                        <select
                          className="portal-input mt-1"
                          aria-label="Role"
                          value={row.role}
                          disabled={disabled}
                          onChange={(event) =>
                            update(
                              rows.map((item, itemIndex) =>
                                itemIndex === index
                                  ? {
                                      ...item,
                                      role: event.target
                                        .value as AppearanceRole,
                                    }
                                  : item,
                              ),
                            )
                          }
                        >
                          <option value="">Still to place</option>
                          {ROLES.map((role) => (
                            <option key={role.value} value={role.value}>
                              {role.label}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="text-sm text-[var(--text-muted)]">
                        Additional notes (MC instructions, games, special
                        happenings, announcements)
                        <textarea
                          className="portal-input mt-1 min-h-20"
                          value={row.notes}
                          disabled={disabled}
                          onChange={(event) =>
                            update(
                              rows.map((item, itemIndex) =>
                                itemIndex === index
                                  ? { ...item, notes: event.target.value }
                                  : item,
                              ),
                            )
                          }
                        />
                      </label>
                      <div className="flex gap-2">
                        <button
                          type="button"
                          className="min-h-11 text-sm"
                          aria-label={`Move name ${index + 1} up`}
                          disabled={disabled || index === 0}
                          onClick={() => update(move(rows, index, -1))}
                        >
                          Up
                        </button>
                        <button
                          type="button"
                          className="min-h-11 text-sm"
                          aria-label={`Move name ${index + 1} down`}
                          disabled={disabled || index === rows.length - 1}
                          onClick={() => update(move(rows, index, 1))}
                        >
                          Down
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              ))}
            </div>
            {group.role ? (
              <button
                type="button"
                className="mt-3 min-h-11 text-sm text-[var(--text-muted)]"
                disabled={disabled || rows.length >= 12}
                onClick={() =>
                  update([
                    ...rows,
                    {
                      names: '',
                      people: '',
                      when: '',
                      notes: '',
                      role: group.role,
                    },
                  ])
                }
              >
                + Add a name or group
              </button>
            ) : null}
          </section>
        )
      })}
    </div>
  )
}

function Platform({ value }: { value: string }) {
  const name = linkPlatform(value)
  if (!value.trim()) return null
  return (
    <p className="mt-2 text-sm text-[var(--pink-soft)]">
      {name || 'Paste a Spotify, YouTube, Apple Music, or SoundCloud link.'}
    </p>
  )
}

function MusicIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M9 18a3 3 0 1 1-2-2.83V6.5l10-2v9.67A3 3 0 1 1 15 16.5V8.2l-6 1.2V18Z"
        fill="currentColor"
      />
    </svg>
  )
}

function songsOrLegacy(items: SongItem[], legacy: string): SongItem[] {
  if (items.length) return items
  if (!legacy.trim()) return []
  return [{ song: legacy.trim(), artist: '', link: '' }]
}

function reorder<T>(items: T[], from: number, to: number): T[] {
  if (
    from === to ||
    from < 0 ||
    to < 0 ||
    from >= items.length ||
    to >= items.length
  )
    return items
  const next = items.slice()
  const [item] = next.splice(from, 1)
  if (!item) return items
  next.splice(to, 0, item)
  return next
}

function move<T>(items: T[], index: number, direction: -1 | 1): T[] {
  const next = items.slice()
  const target = index + direction
  const current = next[index]
  const swap = next[target]
  if (!current || !swap) return items
  next[index] = swap
  next[target] = current
  return next
}

function isoOrBlank(question: Question, value: string): string {
  if (question.type !== 'date') return value
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : ''
}

export { ROLES }

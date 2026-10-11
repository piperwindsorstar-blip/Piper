import { DndContext, closestCenter } from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useRef, useState } from 'react'
import type {
  AppearanceRole,
  AppearanceRow,
  Planning,
  SongItem,
} from '../../lib/crm/planning.ts'
import { itemAt, linkPlatform, textValue } from '../../lib/portal/questions.ts'
import { searchSongs, suggestSongs } from '../../lib/portal/portal.functions.ts'
import { isSongLink } from '../../lib/portal/song-search.ts'
import { suggestionHeading } from '../../lib/portal/song-suggestions.ts'
import type { SongHit } from '../../lib/portal/song-search.ts'
import type { Question } from '../../lib/portal/questions.ts'
import { useListSensors } from './ordered-moments.tsx'
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
  if (question.type === 'chips')
    return <Chips disabled={disabled} chips={question.chips} />
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
      <FromInquiry id={question.id} />
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
      <FromInquiry id={question.id} />
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

function Chips({ disabled, chips }: { disabled: boolean; chips?: string[] }) {
  const { planning, editChips, editText } = usePortal()
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState('')
  const presets = chips ?? [
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
  ]
  const options = [
    ...presets,
    ...planning.genreChips.filter((chip) => !presets.includes(chip)),
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
  const { page, planning, editTimeline, removeMoment } = usePortal()
  const index = question.timelineIndex ?? 0
  const row = itemAt(planning.timeline, index)
  if (!row) return null
  const platform = linkPlatform(row.link)
  const picked = Boolean(
    row.song.trim() || row.artist.trim() || row.link.trim(),
  )
  const linked = row.songFrom !== ''
  const custom = row.presetKey === ''
  return (
    <div>
      {linked ? (
        <div className="rounded-[18px] border-2 border-[var(--pink)] bg-[var(--pink-tint)] p-4">
          <p className="font-bold">{row.song.trim() || 'Song title'}</p>
          <p className="text-sm text-[var(--pink-soft)]">
            {[row.artist.trim() || 'Artist', platform]
              .filter(Boolean)
              .join(' · ')}
          </p>
          <Link
            to="/portal/appearance"
            search={{ q: 'appearances' }}
            hash={
              row.songFrom === 'entrance'
                ? 'entrance-song'
                : `row-${row.songFrom}`
            }
            className="mt-3 inline-flex min-h-11 items-center text-sm text-[var(--pink-soft)] underline"
          >
            Song set in Order of appearance
          </Link>
        </div>
      ) : (
        <>
          <SongSearch
            disabled={disabled}
            label="Song or link"
            onLink={(link) => editTimeline(index, { link })}
            onPick={(hit) =>
              editTimeline(index, {
                song: hit.title,
                artist: hit.artist,
                link: hit.link,
              })
            }
          />
          <CouplePicks
            slug={page.slug}
            presetKey={row.presetKey}
            disabled={disabled}
            onPick={(hit) =>
              editTimeline(index, {
                song: hit.title,
                artist: hit.artist,
                link: hit.link,
              })
            }
          />
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
          </div>
        </>
      )}
      <div className="mt-4 grid gap-3 min-[1024px]:grid-cols-2">
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
          <span className="sr-only">People</span>
          <input
            className="portal-input"
            placeholder="People"
            value={row.people}
            disabled={disabled}
            onChange={(event) =>
              editTimeline(index, { people: event.target.value })
            }
          />
        </label>
        <label className="min-[1024px]:col-span-2">
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
      {linked ? null : (
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
      )}
      <div className="mt-4 flex flex-wrap gap-3">
        {custom && !linked ? (
          <button
            type="button"
            className="min-h-11 text-sm text-[var(--text-muted)] underline"
            disabled={disabled}
            onClick={() => removeMoment(row.id)}
          >
            Delete this moment
          </button>
        ) : (
          <button
            type="button"
            className="min-h-11 text-sm text-[var(--text-muted)] underline"
            disabled={disabled}
            onClick={() => editTimeline(index, { hidden: !row.hidden })}
          >
            {row.hidden ? 'Show this moment' : 'Not part of our day'}
          </button>
        )}
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
  const { planning, editAppearances, setEntranceSong } = usePortal()
  const sensors = useListSensors()
  const rows = planning.appearances.filter(
    (row) =>
      row.names ||
      row.people ||
      row.when ||
      row.notes ||
      row.role ||
      row.song ||
      row.artist ||
      row.link ||
      row.walkUp,
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
  function onDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : ''
    const activeId = String(event.active.id)
    if (!overId || activeId === overId) return
    const active = rows.find((row) => row.id === activeId)
    const over = rows.find((row) => row.id === overId)
    if (!active || !over || active.role !== over.role) return
    update(reorderRole(rows, active.role, activeId, overId))
  }
  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <div className="grid gap-6">
        {groups.map((group) => {
          const inGroup = rows.filter((row) => (row.role || '') === group.role)
          if (group.role === '' && inGroup.length === 0) return null
          return (
            <section key={group.role || 'open'}>
              <h3 className="text-[11px] font-bold tracking-[0.16em] text-[var(--pink)] uppercase">
                {group.title}
              </h3>
              {group.role === 'entrance' ? (
                <div id="entrance-song" className="mt-3 grid gap-3">
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className={`min-h-11 rounded-full px-4 text-sm ${
                        planning.entranceSongMode === 'one'
                          ? 'bg-[var(--pink)] font-bold text-[#0d0d0d]'
                          : 'border border-[var(--border-strong)]'
                      }`}
                      aria-pressed={planning.entranceSongMode === 'one'}
                      disabled={disabled}
                      onClick={() =>
                        setEntranceSong('one', planning.entranceSong)
                      }
                    >
                      One song for the whole entrance
                    </button>
                    <button
                      type="button"
                      className={`min-h-11 rounded-full px-4 text-sm ${
                        planning.entranceSongMode === 'each'
                          ? 'bg-[var(--pink)] font-bold text-[#0d0d0d]'
                          : 'border border-[var(--border-strong)]'
                      }`}
                      aria-pressed={planning.entranceSongMode === 'each'}
                      disabled={disabled}
                      onClick={() =>
                        setEntranceSong('each', planning.entranceSong)
                      }
                    >
                      A different song for each group
                    </button>
                  </div>
                  {planning.entranceSongMode === 'one' ? (
                    <SongBits
                      labelPrefix="Entrance"
                      song={planning.entranceSong}
                      disabled={disabled}
                      onChange={(song) => setEntranceSong('one', song)}
                    />
                  ) : null}
                </div>
              ) : null}
              <SortableContext
                items={inGroup.map((row) => row.id)}
                strategy={verticalListSortingStrategy}
              >
                <div className="mt-3 grid gap-3">
                  {inGroup.map((row, index) => (
                    <SortableAppearance
                      key={row.id}
                      row={row}
                      position={index + 1}
                      disabled={disabled}
                      first={index === 0}
                      last={index === inGroup.length - 1}
                      showSong={songForRole(row, planning.entranceSongMode)}
                      onPatch={(patch) => update(patchRow(rows, row.id, patch))}
                      onMove={(direction) => {
                        const targetIndex = index + direction
                        if (targetIndex < 0 || targetIndex >= inGroup.length)
                          return
                        const target = inGroup[targetIndex]
                        update(reorderRole(rows, row.role, row.id, target.id))
                      }}
                    />
                  ))}
                </div>
              </SortableContext>
              {group.role ? (
                <button
                  type="button"
                  className="mt-3 min-h-11 text-sm text-[var(--text-muted)]"
                  disabled={disabled || rows.length >= 12}
                  onClick={() =>
                    update([
                      ...rows,
                      {
                        id: `appearance-${Date.now().toString(36)}`,
                        names: '',
                        people: '',
                        when: '',
                        notes: '',
                        role: group.role,
                        song: '',
                        artist: '',
                        link: '',
                        walkUp: false,
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
    </DndContext>
  )
}

function songForRole(row: AppearanceRow, mode: 'one' | 'each'): boolean {
  if (row.role === 'dance' || row.role === 'other') return true
  if (row.role === 'entrance') return mode === 'each'
  if (row.role === 'speech') return row.walkUp
  return false
}

function SortableAppearance({
  row,
  position,
  disabled,
  first,
  last,
  showSong,
  onPatch,
  onMove,
}: {
  row: AppearanceRow
  position: number
  disabled: boolean
  first: boolean
  last: boolean
  showSong: boolean
  onPatch: (patch: Partial<AppearanceRow>) => void
  onMove: (direction: -1 | 1) => void
}) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: row.id, disabled })
  return (
    <article
      ref={setNodeRef}
      id={`row-${row.id}`}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={`rounded-[18px] bg-[var(--field)] p-4 ${isDragging ? 'z-10' : ''}`}
    >
      <div className="flex gap-3">
        <button
          type="button"
          className="grid h-[34px] w-[34px] shrink-0 touch-none place-items-center text-[var(--text-faint)]"
          aria-label={`Drag ${row.names || `name ${position}`}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripDots />
        </button>
        <span className="grid h-[34px] w-[34px] shrink-0 place-items-center rounded-full bg-[var(--pink)] text-sm font-bold text-[#0d0d0d]">
          {position}
        </span>
        <div className="grid min-w-0 flex-1 gap-2">
          <input
            className="bg-transparent font-bold outline-none"
            aria-label={`Names or group ${position}`}
            value={row.names}
            disabled={disabled}
            placeholder="Names or group"
            onChange={(event) => onPatch({ names: event.target.value })}
          />
          <input
            className="bg-transparent text-sm text-[var(--text-muted)] outline-none"
            aria-label={`People ${position}`}
            value={row.people}
            disabled={disabled}
            placeholder="People"
            onChange={(event) => onPatch({ people: event.target.value })}
          />
          <input
            className="bg-transparent text-sm text-[var(--text-muted)] outline-none"
            aria-label={`When it happens ${position}`}
            value={row.when}
            disabled={disabled}
            placeholder="When it happens"
            onChange={(event) => onPatch({ when: event.target.value })}
          />
          <label className="text-sm text-[var(--text-muted)]">
            Role
            <select
              className="portal-input mt-1"
              aria-label={`Role ${position}`}
              value={row.role}
              disabled={disabled}
              onChange={(event) =>
                onPatch({ role: event.target.value as AppearanceRole })
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
          {row.role === 'speech' ? (
            <button
              type="button"
              className="min-h-11 text-left text-sm text-[var(--pink-soft)] underline"
              disabled={disabled}
              onClick={() =>
                onPatch(
                  row.walkUp
                    ? { walkUp: false, song: '', artist: '', link: '' }
                    : { walkUp: true },
                )
              }
            >
              {row.walkUp ? 'Hide walk-up song' : 'Walk-up song'}
            </button>
          ) : null}
          {showSong ? (
            <SongBits
              labelPrefix={
                row.role === 'speech'
                  ? `Walk-up ${position}`
                  : `Song ${position}`
              }
              song={{ song: row.song, artist: row.artist, link: row.link }}
              disabled={disabled}
              onChange={(song) => onPatch(song)}
            />
          ) : null}
          <label className="text-sm text-[var(--text-muted)]">
            Additional notes (MC instructions, games, special happenings,
            announcements)
            <textarea
              className="portal-input mt-1 min-h-20"
              aria-label={`MC notes ${position}`}
              value={row.notes}
              disabled={disabled}
              onChange={(event) => onPatch({ notes: event.target.value })}
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="min-h-11 text-sm"
              aria-label={`Move name ${position} up`}
              disabled={disabled || first}
              onClick={() => onMove(-1)}
            >
              Up
            </button>
            <button
              type="button"
              className="min-h-11 text-sm"
              aria-label={`Move name ${position} down`}
              disabled={disabled || last}
              onClick={() => onMove(1)}
            >
              Down
            </button>
          </div>
        </div>
      </div>
    </article>
  )
}

function SongBits({
  song,
  disabled,
  onChange,
  labelPrefix,
}: {
  song: SongItem
  disabled: boolean
  onChange: (song: SongItem) => void
  labelPrefix: string
}) {
  return (
    <div className="grid gap-2">
      <SongSearch
        disabled={disabled}
        label={`${labelPrefix} song or link`}
        onLink={(link) => onChange({ ...song, link })}
        onPick={(hit) =>
          onChange({ song: hit.title, artist: hit.artist, link: hit.link })
        }
      />
      {song.link.trim() ? <Platform value={song.link} /> : null}
      <input
        className="portal-input"
        aria-label={`${labelPrefix} title`}
        placeholder="Song title"
        value={song.song}
        disabled={disabled}
        onChange={(event) => onChange({ ...song, song: event.target.value })}
      />
      <input
        className="portal-input"
        aria-label={`${labelPrefix} artist`}
        placeholder="Artist"
        value={song.artist}
        disabled={disabled}
        onChange={(event) => onChange({ ...song, artist: event.target.value })}
      />
    </div>
  )
}

function patchRow(
  rows: AppearanceRow[],
  id: string,
  patch: Partial<AppearanceRow>,
): AppearanceRow[] {
  return rows.map((row) => (row.id === id ? { ...row, ...patch } : row))
}

function reorderRole(
  rows: AppearanceRow[],
  role: AppearanceRole,
  fromId: string,
  toId: string,
): AppearanceRow[] {
  const indexes: number[] = []
  rows.forEach((row, index) => {
    if (row.role === role) indexes.push(index)
  })
  const from = indexes.findIndex((index) => rows[index].id === fromId)
  const to = indexes.findIndex((index) => rows[index].id === toId)
  if (from < 0 || to < 0) return rows
  const block = indexes.map((index) => rows[index])
  const nextBlock = block.slice()
  const [moved] = nextBlock.splice(from, 1)
  nextBlock.splice(to, 0, moved)
  const next = rows.slice()
  indexes.forEach((index, cursor) => {
    next[index] = nextBlock[cursor]
  })
  return next
}

function GripDots() {
  return (
    <svg width="14" height="18" viewBox="0 0 14 18" aria-hidden="true">
      {[3, 9, 15].map((y) => (
        <g key={y}>
          <circle cx="4" cy={y} r="1.4" fill="currentColor" />
          <circle cx="10" cy={y} r="1.4" fill="currentColor" />
        </g>
      ))}
    </svg>
  )
}

function CouplePicks({
  slug,
  presetKey,
  disabled,
  onPick,
}: {
  slug: string
  presetKey: string
  disabled: boolean
  onPick: (hit: SongHit) => void
}) {
  const heading = suggestionHeading(presetKey)
  const load = useServerFn(suggestSongs)
  const loadRef = useRef(load)
  loadRef.current = load
  const [hits, setHits] = useState<SongHit[]>([])

  useEffect(() => {
    if (!heading) {
      setHits([])
      return
    }
    let live = true
    void loadRef.current({ data: { slug, presetKey } }).then((rows) => {
      if (live) setHits(rows)
    })
    return () => {
      live = false
    }
  }, [heading, presetKey, slug])

  if (!heading || hits.length === 0) return null
  return (
    <div className="mt-4">
      <p className="text-sm text-[var(--text-muted)]">{heading}</p>
      <div className="mt-2 flex flex-wrap gap-2">
        {hits.map((hit) => (
          <button
            key={`${hit.title}-${hit.artist}`}
            type="button"
            className="min-h-11 rounded-full border border-[var(--border-strong)] px-4 text-left text-sm"
            disabled={disabled}
            onClick={() => onPick(hit)}
          >
            <span className="font-bold">{hit.title}</span>
            {hit.artist ? (
              <span className="text-[var(--pink-soft)]"> · {hit.artist}</span>
            ) : null}
          </button>
        ))}
      </div>
    </div>
  )
}

function SongSearch({
  disabled,
  label,
  onLink,
  onPick,
}: {
  disabled: boolean
  label: string
  onLink: (link: string) => void
  onPick: (hit: SongHit) => void
}) {
  const search = useServerFn(searchSongs)
  const searchRef = useRef(search)
  searchRef.current = search
  const request = useRef(0)
  const [draft, setDraft] = useState('')
  const [hits, setHits] = useState<SongHit[]>([])
  const [status, setStatus] = useState<'idle' | 'loading' | 'empty'>('idle')

  useEffect(() => {
    const query = draft.trim()
    if (disabled || query.length < 2 || isSongLink(query)) {
      setHits([])
      setStatus('idle')
      return
    }
    const id = request.current + 1
    request.current = id
    setStatus('loading')
    let live = true
    const timer = window.setTimeout(() => {
      void searchRef.current({ data: { query } }).then((rows) => {
        if (!live || request.current !== id) return
        setHits(rows)
        setStatus(rows.length === 0 ? 'empty' : 'idle')
      })
    }, 350)
    return () => {
      live = false
      window.clearTimeout(timer)
    }
  }, [disabled, draft])

  return (
    <div>
      <label className="block">
        <span className="sr-only">{label}</span>
        <input
          className="portal-input"
          placeholder="Search a song or paste a link"
          value={draft}
          disabled={disabled}
          onChange={(event) => {
            const next = event.target.value
            setDraft(next)
            if (isSongLink(next)) onLink(next.trim())
          }}
        />
      </label>
      {status === 'loading' ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">Searching…</p>
      ) : null}
      {status === 'empty' ? (
        <p className="mt-2 text-sm text-[var(--text-muted)]">
          No song under that name. Paste a link instead.
        </p>
      ) : null}
      {hits.length > 0 ? (
        <ul className="mt-2 grid gap-2">
          {hits.map((hit, index) => (
            <li key={`${hit.link}-${index}`}>
              <button
                type="button"
                className="flex min-h-11 w-full items-center justify-between gap-3 rounded-[18px] border border-[var(--border-strong)] bg-[var(--field)] px-4 py-3 text-left"
                onClick={() => {
                  onPick(hit)
                  setDraft('')
                  setHits([])
                  setStatus('idle')
                }}
              >
                <span className="min-w-0">
                  <span className="block truncate font-bold">{hit.title}</span>
                  <span className="block truncate text-sm text-[var(--pink-soft)]">
                    {hit.artist}
                  </span>
                </span>
                <span className="shrink-0 text-sm text-[var(--text-muted)]">
                  Use this
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
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

function FromInquiry({ id }: { id: string }) {
  const { planning } = usePortal()
  if (!planning.fromInquiry.includes(id)) return null
  if (textValue(planning, id).trim() === '') return null
  return (
    <p className="mt-2 text-sm text-[var(--pink-soft)]">From your inquiry</p>
  )
}

export { ROLES }

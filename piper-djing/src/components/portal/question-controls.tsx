import { useRef, useState } from 'react'
import type { SongItem } from '../../lib/crm/planning.ts'
import { isYesNo, textValue, yesNoAnswer } from '../../lib/portal/questions.ts'
import type { Question } from '../../lib/portal/questions.ts'
import { MomentEditor } from './moment-editors.tsx'
import { usePortal } from './portal-state.tsx'
import { Platform, SongSearch } from './song-pick.tsx'

export function QuestionControl({ question }: { question: Question }) {
  const portal = usePortal()
  const disabled = portal.locked
  if (question.type === 'choice')
    return <Choice question={question} disabled={disabled} />
  if (question.type === 'chips')
    return <Chips disabled={disabled} chips={question.chips} />
  if (question.type === 'song')
    return <MomentEditor question={question} disabled={disabled} />
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
  if (isYesNo(question.options)) {
    const answer = yesNoAnswer(value)
    return (
      <fieldset>
        <legend className="sr-only">{question.label}</legend>
        <div className="grid max-w-md grid-cols-2 gap-3">
          {(question.options ?? []).map((option) => {
            const selected = answer === yesNoAnswer(option.value)
            return (
              <label
                key={option.value}
                className={`flex min-h-[64px] cursor-pointer items-center justify-center rounded-[18px] border-2 px-4 text-xl font-bold ${
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
                {option.value}
              </label>
            )
          })}
        </div>
      </fieldset>
    )
  }
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
        <p className="mt-3 text-sm text-[var(--text-muted)]">{`Saved note: ${value ?? ''}`}
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
  // The row a pasted link went into, so more typing updates it, not adds rows.
  const linkRow = useRef<number | null>(null)
  const items =
    id === 'mustPlay'
      ? songsOrLegacy(planning.mustPlayItems, planning.mustPlay)
      : songsOrLegacy(planning.doNotPlayItems, planning.doNotPlay)
  function update(next: SongItem[]) {
    editSongs(id, next)
  }
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-3">
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
                    disabled={disabled}
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
            {open && !disabled ? (
              <div className="mt-2 flex justify-end gap-4 pl-[46px]">
                <button
                  type="button"
                  className="min-h-11 text-sm text-[var(--text-muted)] underline"
                  onClick={() => {
                    linkRow.current = null
                    setEditing(null)
                    update(items.filter((_, rowIndex) => rowIndex !== index))
                  }}
                >
                  Remove
                </button>
                {item.song.trim() ? (
                  <button
                    type="button"
                    className="min-h-11 text-sm font-bold underline"
                    onClick={() => setEditing(null)}
                  >
                    Done
                  </button>
                ) : null}
              </div>
            ) : null}
          </article>
        )
      })}
      <SongSearch
        disabled={disabled}
        label={
          id === 'mustPlay' ? 'Add a must-play song' : 'Add a song not to play'
        }
        onLink={(link) => {
          const row = linkRow.current
          if (row !== null && items[row] && !items[row].song.trim()) {
            update(
              items.map((item, rowIndex) =>
                rowIndex === row ? { ...item, link } : item,
              ),
            )
            return
          }
          linkRow.current = items.length
          setEditing(items.length)
          update([...items, { song: '', artist: '', link }])
        }}
        onPick={(hit) => {
          linkRow.current = null
          update([
            ...items,
            { song: hit.title, artist: hit.artist, link: hit.link },
          ])
        }}
      />
      <button
        type="button"
        disabled={disabled}
        className="min-h-11 text-left text-sm text-[var(--text-muted)] underline"
        onClick={() => {
          linkRow.current = null
          setEditing(items.length)
          update([...items, { song: '', artist: '', link: '' }])
        }}
      >
        Type one in instead
      </button>
    </div>
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

import type { ReactNode } from 'react'
import {
  PARTY_OPTIONS,
  addCustomEntry,
  entryHasSong,
  entryName,
  isCustomEntry,
  momentKind,
  pairCount,
  patchEntry,
  removeEntry,
  setEntranceMode,
  setPairCount,
  togglePartyEntry,
} from '../../lib/crm/planning.ts'
import type {
  EntranceMode,
  MomentEntry,
  TimelineRow,
} from '../../lib/crm/planning.ts'
import { itemAt, linkPlatform } from '../../lib/portal/questions.ts'
import type { Question } from '../../lib/portal/questions.ts'
import { usePortal } from './portal-state.tsx'
import { CouplePicks, MusicIcon, Platform, SongSearch } from './song-pick.tsx'

type Patch = (patch: Partial<TimelineRow>) => void

/** What a moment asks for depends on what the moment is. */
export function MomentEditor({
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
  const patch: Patch = (next) => editTimeline(index, next)
  const kind = momentKind(row.presetKey)
  return (
    <div>
      {kind === 'time' ? (
        <TimeOnly row={row} patch={patch} disabled={disabled} />
      ) : kind === 'playlist' ? (
        <PlaylistMoment row={row} patch={patch} disabled={disabled} />
      ) : kind === 'speakers' ? (
        <Speakers row={row} patch={patch} disabled={disabled} />
      ) : kind === 'party' ? (
        <BridalParty row={row} patch={patch} disabled={disabled} />
      ) : kind === 'entrance-party' ? (
        <WholePartyEntrance row={row} patch={patch} disabled={disabled} />
      ) : kind === 'entrance-couple' ? (
        <CoupleEntrance row={row} patch={patch} disabled={disabled} />
      ) : (
        <SingleSong row={row} patch={patch} disabled={disabled} />
      )}
      <MomentFooter
        row={row}
        patch={patch}
        disabled={disabled}
        renamable={
          kind !== 'time' && kind !== 'playlist' && kind !== 'speakers'
        }
      />
    </div>
  )
}

function Field({
  label,
  placeholder,
  value,
  disabled,
  onChange,
  wide,
}: {
  label: string
  placeholder: string
  value: string
  disabled: boolean
  onChange: (value: string) => void
  wide?: boolean
}) {
  return (
    <label className={wide ? 'min-[1024px]:col-span-2' : undefined}>
      <span className="sr-only">{label}</span>
      <input
        className="portal-input"
        placeholder={placeholder}
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
      />
    </label>
  )
}

function TimeAndNotes({
  row,
  patch,
  disabled,
  notes = true,
  placeholder = 'Notes: start at, fade out, special edit...',
}: {
  row: TimelineRow
  patch: Patch
  disabled: boolean
  notes?: boolean
  placeholder?: string
}) {
  return (
    <div className="mt-4 grid gap-3 min-[1024px]:grid-cols-2">
      <Field
        label="Time"
        placeholder="Time: 6:10 pm"
        value={row.time}
        disabled={disabled}
        onChange={(time) => patch({ time })}
      />
      {notes ? (
        <Field
          label="Notes"
          placeholder={placeholder}
          value={row.notes}
          disabled={disabled}
          onChange={(value) => patch({ notes: value })}
          wide
        />
      ) : null}
    </div>
  )
}

function TimeOnly({
  row,
  patch,
  disabled,
}: {
  row: TimelineRow
  patch: Patch
  disabled: boolean
}) {
  return (
    <div className="grid gap-3 min-[1024px]:grid-cols-2">
      <Field
        label="Time"
        placeholder="Time: 3:30 pm"
        value={row.time}
        disabled={disabled}
        onChange={(time) => patch({ time })}
      />
    </div>
  )
}

function PlaylistMoment({
  row,
  patch,
  disabled,
}: {
  row: TimelineRow
  patch: Patch
  disabled: boolean
}) {
  return (
    <div>
      <label className="block">
        <span className="sr-only">Playlist link</span>
        <input
          className="portal-input"
          type="url"
          placeholder="Playlist link (Spotify, YouTube, Apple Music or SoundCloud)"
          value={row.link}
          disabled={disabled}
          onChange={(event) => patch({ link: event.target.value })}
        />
      </label>
      <Platform value={row.link} />
      <TimeAndNotes
        row={row}
        patch={patch}
        disabled={disabled}
        placeholder="Notes: songs to skip, how loud, anything for the room"
      />
    </div>
  )
}

function Speakers({
  row,
  patch,
  disabled,
}: {
  row: TimelineRow
  patch: Patch
  disabled: boolean
}) {
  const entries = row.entries
  // An empty list still shows one speech to fill in.
  const shown: MomentEntry[] =
    entries.length > 0
      ? entries
      : [{ id: 'custom-1', name: '', time: '', song: '', artist: '', link: '' }]
  function edit(entry: MomentEntry, change: Partial<Omit<MomentEntry, 'id'>>) {
    patch({
      entries: entries.some((item) => item.id === entry.id)
        ? patchEntry(entries, entry.id, change)
        : [{ ...entry, ...change }],
    })
  }
  return (
    <div>
      <ul className="grid gap-3">
        {shown.map((entry, index) => (
          <li
            key={entry.id}
            className="grid gap-3 min-[1024px]:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_auto]"
          >
            <Field
              label={`Who is speaking (speech ${index + 1})`}
              placeholder="Person speaking"
              value={entry.name}
              disabled={disabled}
              onChange={(name) => edit(entry, { name })}
            />
            <Field
              label={`When (speech ${index + 1})`}
              placeholder="When: 7:15 pm"
              value={entry.time}
              disabled={disabled}
              onChange={(time) => edit(entry, { time })}
            />
            {entries.length > 0 ? (
              <button
                type="button"
                className="min-h-11 text-left text-sm text-[var(--text-muted)] underline"
                disabled={disabled}
                onClick={() =>
                  patch({ entries: removeEntry(entries, entry.id) })
                }
              >
                Remove
              </button>
            ) : null}
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-3 min-h-11 text-left text-sm text-[var(--pink-soft)]"
        disabled={disabled || entries.length === 0}
        onClick={() => patch({ entries: addCustomEntry(entries) })}
      >
        + Add another speech
      </button>
    </div>
  )
}

function BridalParty({
  row,
  patch,
  disabled,
}: {
  row: TimelineRow
  patch: Patch
  disabled: boolean
}) {
  const entries = row.entries
  const standard = PARTY_OPTIONS.filter((option) =>
    entries.some((entry) => entry.id === option.id),
  )
  return (
    <div>
      <p className="text-sm text-[var(--text-muted)]">
        Who is walking in? Pick every group, then choose a song for each.
      </p>
      <div className="mt-3 flex flex-wrap gap-2">
        {PARTY_OPTIONS.map((option) => {
          const on = entries.some((entry) => entry.id === option.id)
          return (
            <ToggleChip
              key={option.id}
              on={on}
              disabled={disabled}
              onClick={() =>
                patch({ entries: togglePartyEntry(entries, option.id, !on) })
              }
            >
              {option.name}
            </ToggleChip>
          )
        })}
      </div>
      <EntryList
        entries={entries}
        order={[...standard.map((option) => option.id)]}
        disabled={disabled}
        onChange={(next) => patch({ entries: next })}
        fallback={(entry) =>
          PARTY_OPTIONS.find((option) => option.id === entry.id)?.name ??
          'Someone else'
        }
        addLabel="+ Add someone else"
      />
      <TimeAndNotes row={row} patch={patch} disabled={disabled} />
    </div>
  )
}

const MODES: Array<{ value: EntranceMode; label: string; hint: string }> = [
  { value: 'pairs', label: 'In pairs', hint: 'A song for each pair' },
  {
    value: 'split',
    label: 'Bridesmaids and groomsmen',
    hint: 'A song for each group',
  },
  { value: 'whole', label: 'Everyone together', hint: 'One song for all' },
]

function WholePartyEntrance({
  row,
  patch,
  disabled,
}: {
  row: TimelineRow
  patch: Patch
  disabled: boolean
}) {
  const entries = row.entries
  const mode = row.mode
  const pairs = pairCount(entries)
  return (
    <div>
      <p className="text-sm text-[var(--text-muted)]">
        How does the wedding party come in?
      </p>
      <div className="mt-3 grid gap-2 min-[720px]:grid-cols-3">
        {MODES.map((option) => (
          <button
            key={option.value}
            type="button"
            aria-pressed={mode === option.value}
            disabled={disabled}
            className={`min-h-11 rounded-[18px] border-[1.5px] px-4 py-3 text-left ${
              mode === option.value
                ? 'border-[var(--pink)] bg-[var(--pink-tint)]'
                : 'border-[var(--border-strong)]'
            }`}
            onClick={() =>
              patch({
                mode: option.value,
                entries: setEntranceMode(entries, option.value, pairs || 2),
              })
            }
          >
            <span className="block font-bold">{option.label}</span>
            <span className="block text-sm text-[var(--text-muted)]">
              {option.hint}
            </span>
          </button>
        ))}
      </div>
      {mode === 'pairs' ? (
        <label className="mt-4 flex items-center gap-3">
          <span className="text-sm">How many pairs?</span>
          <input
            className="portal-input w-24"
            type="number"
            min={1}
            max={12}
            inputMode="numeric"
            value={pairs}
            disabled={disabled}
            onChange={(event) => {
              const next = Number(event.target.value)
              if (!Number.isFinite(next) || next < 1) return
              patch({ entries: setPairCount(entries, next) })
            }}
          />
        </label>
      ) : null}
      {mode ? (
        <EntryList
          entries={entries}
          order={entries
            .filter((entry) => !isCustomEntry(entry))
            .map((e) => e.id)}
          disabled={disabled}
          onChange={(next) => patch({ entries: next })}
          fallback={(entry) => {
            if (entry.id.startsWith('pair-')) return `Pair ${entry.id.slice(5)}`
            if (entry.id === 'bridesmaids') return 'Bridesmaids'
            if (entry.id === 'groomsmen') return 'Groomsmen'
            if (entry.id === 'whole') return 'Whole wedding party'
            return 'Added'
          }}
          renamePairs
          addLabel="+ Add your own"
        />
      ) : null}
      <TimeAndNotes row={row} patch={patch} disabled={disabled} />
    </div>
  )
}

function CoupleEntrance({
  row,
  patch,
  disabled,
}: {
  row: TimelineRow
  patch: Patch
  disabled: boolean
}) {
  return (
    <div>
      <SingleSong row={row} patch={patch} disabled={disabled} />
      <label className="mt-4 flex min-h-11 items-center gap-3">
        <input
          type="checkbox"
          className="h-5 w-5 accent-[var(--pink)]"
          checked={row.direct}
          disabled={disabled}
          onChange={(event) => patch({ direct: event.target.checked })}
        />
        <span>We want to go straight into our first dance</span>
      </label>
    </div>
  )
}

function ToggleChip({
  on,
  disabled,
  onClick,
  children,
}: {
  on: boolean
  disabled: boolean
  onClick: () => void
  children: ReactNode
}) {
  return (
    <button
      type="button"
      aria-pressed={on}
      disabled={disabled}
      className={`min-h-11 rounded-full border-[1.5px] px-5 text-sm font-bold ${
        on
          ? 'border-[var(--pink)] bg-[var(--pink-tint)]'
          : 'border-[var(--border-strong)]'
      }`}
      onClick={onClick}
    >
      {on ? '✓ ' : ''}
      {children}
    </button>
  )
}

/** Cards for a list of people, each with a song, plus manual extras. */
function EntryList({
  entries,
  order,
  disabled,
  onChange,
  fallback,
  addLabel,
  renamePairs = false,
}: {
  entries: MomentEntry[]
  order: string[]
  disabled: boolean
  onChange: (next: MomentEntry[]) => void
  fallback: (entry: MomentEntry) => string
  addLabel: string
  renamePairs?: boolean
}) {
  const standard = order
    .map((id) => entries.find((entry) => entry.id === id))
    .filter((entry): entry is MomentEntry => Boolean(entry))
  const customs = entries.filter(isCustomEntry)
  return (
    <div>
      <ul className="mt-4 grid gap-4">
        {standard.map((entry) => (
          <li
            key={entry.id}
            className="rounded-[18px] border border-[var(--border-strong)] p-4"
          >
            {renamePairs && entry.id.startsWith('pair-') ? (
              <Field
                label={fallback(entry)}
                placeholder={`${fallback(entry)}: who is walking together`}
                value={entry.name}
                disabled={disabled}
                onChange={(name) =>
                  onChange(patchEntry(entries, entry.id, { name }))
                }
              />
            ) : (
              <p className="font-bold">{entryName(entry, fallback(entry))}</p>
            )}
            <EntrySong
              entry={entry}
              disabled={disabled}
              onChange={(patch) =>
                onChange(patchEntry(entries, entry.id, patch))
              }
            />
          </li>
        ))}
        {customs.map((entry) => (
          <li
            key={entry.id}
            className="rounded-[18px] border border-[var(--border-strong)] p-4"
          >
            <Field
              label="Who is this"
              placeholder="Who is this? (a flower girl, a pet, a parent...)"
              value={entry.name}
              disabled={disabled}
              onChange={(name) =>
                onChange(patchEntry(entries, entry.id, { name }))
              }
            />
            <EntrySong
              entry={entry}
              disabled={disabled}
              onChange={(patch) =>
                onChange(patchEntry(entries, entry.id, patch))
              }
            />
            <button
              type="button"
              className="mt-2 min-h-11 text-sm text-[var(--text-muted)] underline"
              disabled={disabled}
              onClick={() => onChange(removeEntry(entries, entry.id))}
            >
              Remove
            </button>
          </li>
        ))}
      </ul>
      <button
        type="button"
        className="mt-3 min-h-11 text-left text-sm text-[var(--pink-soft)]"
        disabled={disabled}
        onClick={() => onChange(addCustomEntry(entries))}
      >
        {addLabel}
      </button>
    </div>
  )
}

function EntrySong({
  entry,
  disabled,
  onChange,
}: {
  entry: MomentEntry
  disabled: boolean
  onChange: (patch: Partial<Omit<MomentEntry, 'id'>>) => void
}) {
  const platform = linkPlatform(entry.link)
  return (
    <div className="mt-3">
      <SongSearch
        disabled={disabled}
        label={`Song or link for ${entry.name || 'this entry'}`}
        onLink={(link) => onChange({ link })}
        onPick={(hit) =>
          onChange({ song: hit.title, artist: hit.artist, link: hit.link })
        }
      />
      {entry.link.trim() ? <Platform value={entry.link} /> : null}
      {entryHasSong(entry) ? (
        <p className="mt-3 text-sm text-[var(--pink-soft)]">
          Selected ·{' '}
          {[entry.song.trim(), entry.artist.trim(), platform]
            .filter(Boolean)
            .join(' · ')}
        </p>
      ) : null}
      <div className="mt-3 grid gap-3 min-[1024px]:grid-cols-2">
        <Field
          label="Song title"
          placeholder="Song title"
          value={entry.song}
          disabled={disabled}
          onChange={(song) => onChange({ song })}
        />
        <Field
          label="Artist"
          placeholder="Artist"
          value={entry.artist}
          disabled={disabled}
          onChange={(artist) => onChange({ artist })}
        />
      </div>
    </div>
  )
}

function SingleSong({
  row,
  patch,
  disabled,
}: {
  row: TimelineRow
  patch: Patch
  disabled: boolean
}) {
  const { page } = usePortal()
  const platform = linkPlatform(row.link)
  const picked = entryHasSong(row)
  const pick = (hit: { title: string; artist: string; link: string }) =>
    patch({ song: hit.title, artist: hit.artist, link: hit.link })
  return (
    <div>
      <SongSearch
        disabled={disabled}
        label="Song or link"
        onLink={(link) => patch({ link })}
        onPick={pick}
      />
      <CouplePicks
        slug={page.slug}
        presetKey={row.presetKey}
        disabled={disabled}
        onPick={pick}
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
        <Field
          label="Song title"
          placeholder="Song title"
          value={row.song}
          disabled={disabled}
          onChange={(song) => patch({ song })}
        />
        <Field
          label="Artist"
          placeholder="Artist"
          value={row.artist}
          disabled={disabled}
          onChange={(artist) => patch({ artist })}
        />
      </div>
      <div className="mt-4 grid gap-3 min-[1024px]:grid-cols-2">
        <Field
          label="Time"
          placeholder="Time: 6:10 pm"
          value={row.time}
          disabled={disabled}
          onChange={(time) => patch({ time })}
        />
        <Field
          label="People"
          placeholder="People"
          value={row.people}
          disabled={disabled}
          onChange={(people) => patch({ people })}
        />
        <Field
          label="Notes"
          placeholder="Notes: start at, fade out, special edit..."
          value={row.notes}
          disabled={disabled}
          onChange={(notes) => patch({ notes })}
          wide
        />
      </div>
    </div>
  )
}

function MomentFooter({
  row,
  patch,
  disabled,
  renamable,
}: {
  row: TimelineRow
  patch: Patch
  disabled: boolean
  renamable: boolean
}) {
  const { removeMoment } = usePortal()
  const custom = row.presetKey === ''
  return (
    <>
      {renamable ? (
        <label className="mt-4 block">
          <span className="sr-only">Rename this moment</span>
          <input
            className="portal-input"
            placeholder={`Rename this moment (${row.activity})`}
            value={row.label}
            disabled={disabled}
            onChange={(event) => patch({ label: event.target.value })}
          />
        </label>
      ) : null}
      <div className="mt-4 flex flex-wrap gap-3">
        {custom ? (
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
            onClick={() => patch({ hidden: !row.hidden })}
          >
            {row.hidden ? 'Show this moment' : 'Not part of our day'}
          </button>
        )}
      </div>
    </>
  )
}

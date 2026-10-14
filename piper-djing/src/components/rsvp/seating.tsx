import { useServerFn } from '@tanstack/react-start'
import { useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import {
  MAX_ITEMS,
  MAX_SEATS,
  MAX_TABLES,
  ROOM_ITEMS,
  TABLE_SHAPES,
  addTables,
  assignGuest,
  autoArrange,
  crowdingWarning,
  enlargeRoomToFit,
  findFreeSpot,
  fitTableSize,
  formatLength,
  fromInches,
  guestsAt,
  isItemKind,
  isShape,
  newRoomItem,
  newTable,
  normalAngle,
  overlappingTables,
  removeTable,
  resizeRoom,
  resizeTable,
  seatParty,
  tableLabel,
  tableNameProblem,
  tableSize,
  toInches,
  unseat,
} from '../../lib/rsvp/seating.ts'
import type {
  FloorUnit,
  RoomItem,
  SeatTable,
  SeatableGuest,
  SeatingNotice,
  SeatingPlan,
} from '../../lib/rsvp/seating.ts'
import {
  dismissSeatingNotices,
  saveRsvpSeating,
  saveSeatingImage,
} from '../../lib/rsvp/rsvp.functions.ts'
import type { getRsvpSeating } from '../../lib/rsvp/rsvp.functions.ts'
import { SaveStatus, useAutosave } from './autosave.tsx'
import { FloorPlan } from './floor-plan.tsx'
import type { Selection } from './floor-plan.tsx'
import { SeatingPrintDialog } from './print.tsx'
import { rsvpButton, rsvpGhost } from './shell.tsx'

export type SeatingData = NonNullable<
  Awaited<ReturnType<typeof getRsvpSeating>>
>

const smallField =
  'min-h-11 rounded-2xl border border-[var(--border-strong)] bg-[var(--field)] px-3 text-base text-[var(--text)] outline-none'
const iconButton =
  'grid h-11 w-11 shrink-0 place-items-center rounded-full border border-[var(--border-strong)] text-lg text-[var(--text-muted)] hover:border-[var(--pink)] hover:text-[var(--text)]'

let idCounter = 0
function newId(): string {
  idCounter += 1
  return `tbl-${Date.now().toString(36)}-${idCounter}`
}

export function SeatingChart({ data }: { data: SeatingData }) {
  const save = useServerFn(saveRsvpSeating)
  const dismiss = useServerFn(dismissSeatingNotices)
  const storeImage = useServerFn(saveSeatingImage)
  const [plan, setPlan] = useState<SeatingPlan>(data.plan)
  const [image, setImage] = useState(data.image)
  const [imageNote, setImageNote] = useState('')
  const [notices, setNotices] = useState<SeatingNotice[]>(data.plan.notices)
  const [problem, setProblem] = useState('')
  const [selection, setSelection] = useState<Selection>(null)
  const [selected, setSelected] = useState('')
  const [placing, setPlacing] = useState('')
  const [count, setCount] = useState('6')
  const [printing, setPrinting] = useState(false)
  const [roomOpen, setRoomOpen] = useState(false)
  const [arranged, setArranged] = useState(false)
  const [enlarge, setEnlarge] = useState(0)
  const planRef = useRef(plan)
  planRef.current = plan

  const guests: SeatableGuest[] = data.guests
  const byId = useMemo(
    () => new Map(guests.map((guest) => [guest.id, guest])),
    [guests],
  )
  const seatedCount = guests.filter((guest) => plan.seats[guest.id]).length
  const unit = plan.room.unit

  const autosave = useAutosave<SeatingPlan>(async (draft) => {
    const result = await save({
      data: {
        tables: draft.tables,
        seats: draft.seats,
        room: draft.room,
        items: draft.items,
      },
    })
    if (!result.ok) {
      console.warn('[seating] save refused:', result.error)
      return { ok: false, error: result.error }
    }
    // The server moved guests sitting on a missing or doubled-up chair; show
    // what was saved, unless something newer has changed since.
    if (result.repaired > 0 && planRef.current.seats === draft.seats) {
      const fixed = { ...planRef.current, seats: result.plan.seats }
      planRef.current = fixed
      setPlan(fixed)
    }
    return { ok: true }
  })

  /** Every change goes through here: checked, shown, then saved shortly. */
  function commit(next: SeatingPlan, now = false) {
    planRef.current = next
    setPlan(next)
    setProblem('')
    const names = tableNameProblem(next.tables)
    if (names) {
      autosave.hold(names)
      return
    }
    if (now) autosave.flush(next)
    else autosave.schedule(next)
  }

  function change(
    result: { ok: true; plan: SeatingPlan } | { ok: false; error: string },
  ) {
    if (!result.ok) {
      setProblem(result.error)
      return false
    }
    commit(result.plan)
    return true
  }

  function seatGuest(guestId: string, tableId: string, seat?: number) {
    if (!tableId) {
      commit(unseat(planRef.current, guestId))
      return
    }
    if (change(assignGuest(planRef.current, guestId, tableId, seat))) {
      setPlacing('')
    }
  }

  function patchTable(id: string, patch: Partial<SeatTable>) {
    commit({
      ...planRef.current,
      tables: planRef.current.tables.map((table) =>
        table.id === id ? { ...table, ...patch } : table,
      ),
    })
  }

  function patchItem(id: string, patch: Partial<RoomItem>) {
    commit({
      ...planRef.current,
      items: planRef.current.items.map((item) =>
        item.id === id ? { ...item, ...patch } : item,
      ),
    })
  }

  async function uploadImage(file: File) {
    setImageNote('Uploading…')
    try {
      const dataUrl = await shrinkImage(file)
      const result = await storeImage({ data: { image: dataUrl } })
      if (!result.ok) {
        setImageNote(result.error)
        return
      }
      setImage(dataUrl)
      setImageNote('✓ Floor plan added. Trace your tables over it.')
    } catch {
      setImageNote('That picture could not be read. Try a JPG or PNG.')
    }
  }

  const unassigned = guests.filter((guest) => !plan.seats[guest.id])
  const parties = groupByParty(unassigned)
  const selectedGuest = selected ? byId.get(selected) : undefined
  const selectedSpot = selected ? plan.seats[selected] : undefined
  const selectedTable = selectedSpot
    ? plan.tables.find((table) => table.id === selectedSpot.tableId)
    : undefined
  const pickedTable =
    selection?.kind === 'table'
      ? plan.tables.find((table) => table.id === selection.id)
      : undefined
  const pickedItem =
    selection?.kind === 'item'
      ? plan.items.find((item) => item.id === selection.id)
      : undefined
  const clashing = overlappingTables(plan)
  const tight = [
    ...plan.tables.map((table) => crowdingWarning(table)).filter(Boolean),
    ...(clashing.length > 0
      ? [
          `${plan.tables
            .filter((table) => clashing.includes(table.id))
            .map((table) => tableLabel(table.name))
            .join(', ')} ${clashing.length === 1 ? 'runs' : 'run'} into another table or room item. Drag ${clashing.length === 1 ? 'it' : 'them'} apart or use Auto-arrange tables.`,
        ]
      : []),
  ]

  return (
    <div>
      <SeatingPrintDialog
        open={printing}
        onClose={() => setPrinting(false)}
        plan={plan}
        guests={guests}
        couple={data.couple}
        dateLabel={data.dateLabel}
      />
      <div className="print:hidden">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs tracking-[0.16em] text-[var(--text-muted)]">
              SEATING CHART
            </p>
            <h1 className="portal-display text-4xl">
              {seatedCount} of {guests.length} seated
            </h1>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Only guests who said they&apos;re attending can be seated.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <SaveStatus phase={autosave.phase} error={autosave.error} />
            <button
              type="button"
              className={`${rsvpGhost} w-auto`}
              onClick={() => setPrinting(true)}
            >
              Print / PDF
            </button>
          </div>
        </div>

        {notices.length > 0 ? (
          <section
            className="mt-4 rounded-3xl border border-[var(--pink)] bg-[var(--surface)] p-4"
            role="status"
          >
            <div className="flex items-start justify-between gap-3">
              <h2 className="font-semibold">Seating changes from RSVPs</h2>
              <button
                type="button"
                className="min-h-11 px-2 text-sm text-[var(--pink-soft)]"
                onClick={() => {
                  setNotices([])
                  void dismiss().catch(() => undefined)
                }}
              >
                Dismiss
              </button>
            </div>
            <ul className="mt-2 grid gap-1 text-sm text-[var(--text-muted)]">
              {notices.map((notice) => (
                <li key={notice.id}>{notice.text}</li>
              ))}
            </ul>
          </section>
        ) : null}

        {problem ? (
          <p
            className="mt-4 rounded-2xl border border-[var(--pink)] bg-[var(--pink-tint)] px-4 py-3 text-sm text-[var(--text)]"
            role="alert"
          >
            {problem}
          </p>
        ) : null}

        {plan.tables.length === 0 ? (
          <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="font-semibold">Tables</h2>
            <div className="mt-3 flex flex-wrap items-end gap-3">
              <label className="text-sm" htmlFor="table-count">
                How many tables?
                <input
                  id="table-count"
                  type="number"
                  inputMode="numeric"
                  min={1}
                  max={MAX_TABLES}
                  className={`${smallField} mt-1 block w-28`}
                  value={count}
                  onChange={(event) => setCount(event.target.value)}
                />
              </label>
              <button
                type="button"
                className={`${rsvpButton} w-auto`}
                onClick={() => {
                  const wanted = Number(count)
                  if (!Number.isFinite(wanted) || wanted < 1) {
                    setProblem('Enter how many tables to create, from 1.')
                    return
                  }
                  commit(addTables(planRef.current, wanted, newId), true)
                }}
              >
                Create tables
              </button>
              <p className="w-full text-sm text-[var(--text-muted)]">
                Each starts as a round table for 8. Tap a table on the floor
                plan to change its number, shape, size and seats.
              </p>
            </div>
          </section>
        ) : null}

        {/* Toolbar */}
        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="button"
            className={`${rsvpGhost} w-auto`}
            disabled={plan.tables.length >= MAX_TABLES}
            onClick={() => {
              const current = planRef.current
              const clear = findFreeSpot(current, tableSize('round', 8))
              const table = newTable(current, newId())
              commit({ ...current, tables: [...current.tables, table] }, true)
              setSelection({ kind: 'table', id: table.id })
              if (!clear) {
                setProblem(
                  'There is no clear floor left, so the new table is in the middle. Make the room bigger or use Auto-arrange tables.',
                )
              }
            }}
          >
            + Add table
          </button>
          <button
            type="button"
            className={`${rsvpGhost} w-auto`}
            disabled={plan.tables.length === 0}
            onClick={() => {
              const result = autoArrange(planRef.current)
              if (result.unplaced > 0) {
                // Never leave tables on top of each other: nothing moves,
                // and the couple can let the room grow to fit.
                setArranged(false)
                setEnlarge(result.unplaced)
                return
              }
              setEnlarge(0)
              setArranged(true)
              commit(result.plan, true)
            }}
          >
            Auto-arrange tables
          </button>
          {arranged ? (
            <SaveStatus phase={autosave.phase} error={autosave.error} />
          ) : null}
          <select
            className={`${smallField} w-auto text-sm`}
            aria-label="Add to the room"
            value=""
            disabled={plan.items.length >= MAX_ITEMS}
            onChange={(event) => {
              const kind = event.target.value
              if (!isItemKind(kind)) return
              const item = newRoomItem(kind, planRef.current.room, newId())
              commit(
                { ...planRef.current, items: [...planRef.current.items, item] },
                true,
              )
              setSelection({ kind: 'item', id: item.id })
            }}
          >
            <option value="">+ Add to room…</option>
            {ROOM_ITEMS.map((item) => (
              <option key={item.kind} value={item.kind}>
                {item.kind === 'label' ? 'Text label' : item.label}
              </option>
            ))}
          </select>
          <label className="flex min-h-11 items-center gap-2 rounded-full border border-[var(--border-strong)] px-3 text-sm">
            <input
              type="checkbox"
              checked={plan.room.snap}
              onChange={(event) =>
                commit({
                  ...planRef.current,
                  room: { ...planRef.current.room, snap: event.target.checked },
                })
              }
            />
            Snap to grid
          </label>
          <button
            type="button"
            className={`${rsvpGhost} w-auto`}
            aria-expanded={roomOpen}
            onClick={() => setRoomOpen((open) => !open)}
          >
            Room {formatLength(plan.room.width, unit, 'room')} ×{' '}
            {formatLength(plan.room.length, unit, 'room')}
          </button>
          <label className={`${rsvpGhost} w-auto cursor-pointer`}>
            {image ? 'Replace floor plan' : 'Upload floor plan'}
            <input
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              onChange={(event) => {
                const file = event.target.files?.[0]
                event.target.value = ''
                if (file) void uploadImage(file)
              }}
            />
          </label>
          {image ? (
            <button
              type="button"
              className="min-h-11 px-3 text-sm text-[var(--pink-soft)]"
              onClick={() => {
                if (!window.confirm('Remove the floor plan picture?')) return
                setImage('')
                setImageNote('')
                void storeImage({ data: { image: '' } }).catch(() => undefined)
              }}
            >
              Remove picture
            </button>
          ) : null}
        </div>
        {enlarge > 0 ? (
          <div
            className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl border border-[var(--pink)] bg-[var(--pink-tint)] px-4 py-3 text-sm text-[var(--text)]"
            role="alert"
          >
            <span>
              {enlarge} table{enlarge === 1 ? '' : 's'} will not fit in a{' '}
              {formatLength(plan.room.width, unit, 'room')} ×{' '}
              {formatLength(plan.room.length, unit, 'room')} room with clear
              walkways. Nothing was moved.
            </span>
            <button
              type="button"
              className={`${rsvpButton} w-auto`}
              onClick={() => {
                const grown = enlargeRoomToFit(planRef.current)
                if (grown.unplaced > 0) {
                  setProblem(
                    'Even the largest room cannot fit every table. Remove a table or seat more guests per table.',
                  )
                  return
                }
                setEnlarge(0)
                setArranged(true)
                commit(grown.plan, true)
              }}
            >
              Enlarge room to fit
            </button>
            <button
              type="button"
              className="min-h-11 px-2 text-[var(--pink-soft)]"
              onClick={() => setEnlarge(0)}
            >
              Not now
            </button>
          </div>
        ) : null}
        {imageNote ? (
          <p className="mt-2 text-sm text-[var(--text-muted)]" role="status">
            {imageNote}
          </p>
        ) : null}

        {roomOpen ? (
          <RoomSettings
            plan={plan}
            onChange={(next) => commit(next)}
            onClose={() => setRoomOpen(false)}
          />
        ) : null}

        {tight.length > 0 ? (
          <ul
            className="mt-3 grid gap-1 rounded-2xl border border-amber-400/60 px-4 py-3 text-sm text-[var(--text)]"
            role="status"
          >
            {tight.map((warning) => (
              <li key={warning}>⚠ {warning}</li>
            ))}
          </ul>
        ) : null}

        <div className="mt-3 grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <section className="min-w-0">
            <div className="overflow-hidden rounded-3xl border border-[var(--border)] bg-[var(--surface)]">
              <FloorPlan
                plan={plan}
                guests={byId}
                image={image}
                selection={selection}
                onSelect={setSelection}
                selectedGuest={selected}
                placing={placing !== ''}
                onChange={(next) => {
                  planRef.current = next
                  setPlan(next)
                }}
                onCommit={(next) => commit(next)}
                onTapSeat={(tableId, seat, guestId) => {
                  if (placing) {
                    if (guestId) {
                      setProblem(
                        'That seat is taken. Tap an empty seat, or move that guest first.',
                      )
                      return
                    }
                    seatGuest(placing, tableId, seat)
                    return
                  }
                  setSelected(guestId ?? '')
                  setSelection({ kind: 'table', id: tableId })
                }}
                onDropGuest={(guestId, tableId, seat) => {
                  const occupied =
                    seat !== undefined &&
                    Object.entries(planRef.current.seats).some(
                      ([other, at]) =>
                        other !== guestId &&
                        at.tableId === tableId &&
                        at.seat === seat,
                    )
                  // Dropped on a taken seat: the first free one at that table.
                  seatGuest(guestId, tableId, occupied ? undefined : seat)
                }}
              />
            </div>
            <p className="mt-2 text-xs text-[var(--text-faint)]">
              Drag tables and room items to match your venue. Drag a corner to
              resize, the round handle to turn. Pinch or use + and − to zoom;
              drag the empty floor to move around.
            </p>
            {selectedGuest && selectedTable ? (
              <section
                className="mt-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4"
                aria-live="polite"
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <p className="font-semibold">{selectedGuest.name}</p>
                    <p className="text-sm text-[var(--text-muted)]">
                      {tableLabel(selectedTable.name)} · seat{' '}
                      {(selectedSpot?.seat ?? 0) + 1} ·{' '}
                      {selectedGuest.partyName}
                    </p>
                  </div>
                  <MealTag
                    meal={selectedGuest.meal}
                    child={selectedGuest.isChild}
                  />
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  <TablePicker
                    plan={plan}
                    value={selectedTable.id}
                    label={`Move ${selectedGuest.name}`}
                    onChange={(tableId) => seatGuest(selectedGuest.id, tableId)}
                  />
                  <button
                    type="button"
                    className={`${rsvpGhost} w-auto`}
                    onClick={() => {
                      commit(unseat(planRef.current, selectedGuest.id))
                      setSelected('')
                    }}
                  >
                    Unseat
                  </button>
                </div>
              </section>
            ) : null}
          </section>

          <aside className="grid content-start gap-4">
            {pickedTable ? (
              <TablePanel
                key={pickedTable.id}
                table={pickedTable}
                plan={plan}
                byId={byId}
                unit={unit}
                onPatch={(patch) => patchTable(pickedTable.id, patch)}
                onSeats={(seats) =>
                  change(resizeTable(planRef.current, pickedTable.id, seats))
                }
                onSeatGuest={seatGuest}
                onRemove={() => {
                  const sitting = guestsAt(planRef.current, pickedTable.id).length
                  const message =
                    sitting > 0
                      ? `Remove ${tableLabel(pickedTable.name)}? The ${sitting} guest${sitting === 1 ? '' : 's'} seated there go back to Unassigned.`
                      : `Remove ${tableLabel(pickedTable.name)}?`
                  if (!window.confirm(message)) return
                  commit(removeTable(planRef.current, pickedTable.id), true)
                  setSelection(null)
                }}
                onClose={() => setSelection(null)}
              />
            ) : null}
            {pickedItem ? (
              <ItemPanel
                key={pickedItem.id}
                item={pickedItem}
                unit={unit}
                onPatch={(patch) => patchItem(pickedItem.id, patch)}
                onRemove={() => {
                  if (!window.confirm(`Remove ${pickedItem.label || 'this label'}?`))
                    return
                  commit(
                    {
                      ...planRef.current,
                      items: planRef.current.items.filter(
                        (item) => item.id !== pickedItem.id,
                      ),
                    },
                    true,
                  )
                  setSelection(null)
                }}
                onClose={() => setSelection(null)}
              />
            ) : null}

            <section className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
              <h2 className="font-semibold">
                Unassigned guests{' '}
                <span className="text-[var(--text-muted)]">
                  ({unassigned.length})
                </span>
              </h2>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                Drag a guest onto a table or seat, or pick a table beside their
                name. On a phone, tap a name, then tap an empty seat.
              </p>
              {guests.length === 0 ? (
                <p className="mt-3 text-sm text-[var(--text-muted)]">
                  No one has replied &quot;attending&quot; yet.
                </p>
              ) : unassigned.length === 0 ? (
                <p className="mt-3 text-sm text-emerald-500">
                  Everyone attending has a seat.
                </p>
              ) : null}
              <div className="mt-3 grid gap-3">
                {parties.map((party) => (
                  <article
                    key={party.id}
                    className="rounded-2xl border border-[var(--border)] p-3"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <h3 className="text-sm font-semibold">{party.name}</h3>
                      {party.guests.length > 1 && plan.tables.length > 0 ? (
                        <select
                          className={`${smallField} max-w-[11rem] text-sm`}
                          aria-label={`Seat the whole ${party.name} party`}
                          value=""
                          onChange={(event) => {
                            const tableId = event.target.value
                            if (!tableId) return
                            change(
                              seatParty(
                                planRef.current,
                                party.guests.map((guest) => guest.id),
                                tableId,
                              ),
                            )
                          }}
                        >
                          <option value="">Seat whole party…</option>
                          {plan.tables.map((table) => {
                            const free =
                              table.seats - guestsAt(plan, table.id).length
                            const room = free >= party.guests.length
                            return (
                              <option
                                key={table.id}
                                value={table.id}
                                disabled={!room}
                              >
                                {tableLabel(table.name)}
                                {free <= 0
                                  ? ' · full'
                                  : room
                                    ? ` · ${free} free`
                                    : ` · only ${free} free`}
                              </option>
                            )
                          })}
                        </select>
                      ) : null}
                    </div>
                    <ul className="mt-2 grid gap-2">
                      {party.guests.map((guest) => (
                        <GuestRow
                          key={guest.id}
                          guest={guest}
                          plan={plan}
                          picked={placing === guest.id}
                          onPick={() =>
                            setPlacing((current) =>
                              current === guest.id ? '' : guest.id,
                            )
                          }
                          onTable={(tableId) => seatGuest(guest.id, tableId)}
                        />
                      ))}
                    </ul>
                  </article>
                ))}
              </div>
            </section>
          </aside>
        </div>

        {plan.tables.length > 0 ? (
          <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
            <h2 className="font-semibold">Who sits where</h2>
            <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {plan.tables.map((table) => {
                const sitting = guestsAt(plan, table.id)
                return (
                  <article
                    key={table.id}
                    className="rounded-2xl border border-[var(--border)] p-3"
                    onDragOver={(event) => {
                      if (event.dataTransfer.types.includes('text/x-rsvp-guest'))
                        event.preventDefault()
                    }}
                    onDrop={(event) => {
                      const guestId = event.dataTransfer.getData(
                        'text/x-rsvp-guest',
                      )
                      if (!guestId) return
                      event.preventDefault()
                      seatGuest(guestId, table.id)
                    }}
                  >
                    <h3 className="flex justify-between text-sm font-semibold">
                      <button
                        type="button"
                        className="text-left underline-offset-2 hover:underline"
                        onClick={() =>
                          setSelection({ kind: 'table', id: table.id })
                        }
                      >
                        {tableLabel(table.name)}
                      </button>
                      <span className="text-[var(--text-muted)]">
                        {sitting.length} / {table.seats} seated
                      </span>
                    </h3>
                    <ul className="mt-2 grid gap-2">
                      {sitting.map((guestId) => {
                        const guest = byId.get(guestId)
                        if (!guest) return null
                        return (
                          <GuestRow
                            key={guestId}
                            guest={guest}
                            plan={plan}
                            seat={(plan.seats[guestId]?.seat ?? 0) + 1}
                            onTable={(tableId) => seatGuest(guestId, tableId)}
                          />
                        )
                      })}
                      {sitting.length === 0 ? (
                        <li className="text-sm text-[var(--text-faint)]">
                          Empty
                        </li>
                      ) : null}
                    </ul>
                  </article>
                )
              })}
            </div>
          </section>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="text-sm text-[var(--text-muted)]">
            Changes save on their own.
          </span>
          <SaveStatus phase={autosave.phase} error={autosave.error} />
        </div>
      </div>
    </div>
  )
}

/** Shrinks a photo of the venue layout so it fits comfortably in storage. */
async function shrinkImage(file: File): Promise<string> {
  const url = URL.createObjectURL(file)
  try {
    const picture = await new Promise<HTMLImageElement>((resolve, reject) => {
      const element = new Image()
      element.onload = () => resolve(element)
      element.onerror = () => reject(new Error('unreadable'))
      element.src = url
    })
    let side = 1600
    let quality = 0.72
    for (let attempt = 0; attempt < 5; attempt += 1) {
      const scale = Math.min(1, side / Math.max(picture.width, picture.height))
      const canvas = document.createElement('canvas')
      canvas.width = Math.max(1, Math.round(picture.width * scale))
      canvas.height = Math.max(1, Math.round(picture.height * scale))
      const context = canvas.getContext('2d')
      if (!context) throw new Error('no canvas')
      context.fillStyle = '#ffffff'
      context.fillRect(0, 0, canvas.width, canvas.height)
      context.drawImage(picture, 0, 0, canvas.width, canvas.height)
      const data = canvas.toDataURL('image/jpeg', quality)
      if (data.length < 1_400_000) return data
      side = Math.round(side * 0.75)
      quality = Math.max(0.5, quality - 0.08)
    }
    throw new Error('too large')
  } finally {
    URL.revokeObjectURL(url)
  }
}

function NumberBox({
  label,
  value,
  min,
  max,
  step = 1,
  onCommit,
}: {
  label: string
  value: number
  min: number
  max: number
  step?: number
  onCommit: (value: number) => void
}) {
  const [text, setText] = useState(String(value))
  const [editing, setEditing] = useState(false)
  const shown = editing ? text : String(value)
  return (
    <label className="text-sm">
      {label}
      <input
        type="number"
        inputMode="decimal"
        min={min}
        max={max}
        step={step}
        className={`${smallField} mt-1 w-full`}
        value={shown}
        onFocus={() => {
          setText(String(value))
          setEditing(true)
        }}
        onChange={(event) => {
          setText(event.target.value)
          const number = Number(event.target.value)
          if (event.target.value !== '' && Number.isFinite(number)) {
            onCommit(Math.min(max, Math.max(min, number)))
          }
        }}
        onBlur={() => setEditing(false)}
      />
    </label>
  )
}

function RotateRow({
  rotation,
  onRotate,
}: {
  rotation: number
  onRotate: (degrees: number) => void
}) {
  return (
    <div className="flex flex-wrap items-end gap-2">
      <button
        type="button"
        className={iconButton}
        aria-label="Turn 15° left"
        onClick={() => onRotate(normalAngle(rotation - 15))}
      >
        ↺
      </button>
      <button
        type="button"
        className={iconButton}
        aria-label="Turn 15° right"
        onClick={() => onRotate(normalAngle(rotation + 15))}
      >
        ↻
      </button>
      <div className="w-24">
        <NumberBox
          label="Angle °"
          value={rotation}
          min={0}
          max={359}
          onCommit={(value) => onRotate(normalAngle(value))}
        />
      </div>
    </div>
  )
}

function TablePanel({
  table,
  plan,
  byId,
  unit,
  onPatch,
  onSeats,
  onSeatGuest,
  onRemove,
  onClose,
}: {
  table: SeatTable
  plan: SeatingPlan
  byId: Map<string, SeatableGuest>
  unit: FloorUnit
  onPatch: (patch: Partial<SeatTable>) => void
  onSeats: (seats: number) => void
  onSeatGuest: (guestId: string, tableId: string) => void
  onRemove: () => void
  onClose: () => void
}) {
  const sitting = guestsAt(plan, table.id)
  const even = table.shape === 'round' || table.shape === 'square'
  const warning = crowdingWarning(table)
  const sizeLabel = unit === 'm' ? 'cm' : 'in'
  return (
    <section className="rounded-3xl border border-[var(--pink)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">
          {tableLabel(table.name)}{' '}
          <span className="font-normal text-[var(--text-muted)]">
            · {sitting.length} / {table.seats} seated
          </span>
        </h2>
        <button
          type="button"
          className="min-h-11 px-2 text-[var(--text-muted)]"
          aria-label="Close table panel"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="col-span-2 text-sm">
          Table number or name
          <input
            className={`${smallField} mt-1 w-full`}
            value={table.name}
            maxLength={30}
            onChange={(event) => onPatch({ name: event.target.value })}
          />
        </label>
        <label className="text-sm">
          Shape
          <select
            className={`${smallField} mt-1 w-full`}
            value={table.shape}
            onChange={(event) => {
              const shape = event.target.value
              if (!isShape(shape)) return
              onPatch({ shape, ...fitTableSize(shape, table.w, table.h) })
            }}
          >
            {TABLE_SHAPES.map((shape) => (
              <option key={shape.id} value={shape.id}>
                {shape.label}
              </option>
            ))}
          </select>
        </label>
        <NumberBox
          label="Seats"
          value={table.seats}
          min={1}
          max={MAX_SEATS}
          onCommit={(value) => onSeats(Math.round(value))}
        />
        {even ? (
          <NumberBox
            label={`${table.shape === 'round' ? 'Diameter' : 'Side'} (${sizeLabel})`}
            value={fromInches(table.w, unit, 'table')}
            min={1}
            max={unit === 'm' ? 1500 : 600}
            onCommit={(value) => {
              const inches = toInches(value, unit, 'table')
              onPatch(fitTableSize(table.shape, inches, inches))
            }}
          />
        ) : (
          <>
            <NumberBox
              label={`Length (${sizeLabel})`}
              value={fromInches(table.w, unit, 'table')}
              min={1}
              max={unit === 'm' ? 1500 : 600}
              onCommit={(value) =>
                onPatch(
                  fitTableSize(
                    table.shape,
                    toInches(value, unit, 'table'),
                    table.h,
                  ),
                )
              }
            />
            <NumberBox
              label={`Width (${sizeLabel})`}
              value={fromInches(table.h, unit, 'table')}
              min={1}
              max={unit === 'm' ? 1500 : 600}
              onCommit={(value) =>
                onPatch(
                  fitTableSize(
                    table.shape,
                    table.w,
                    toInches(value, unit, 'table'),
                  ),
                )
              }
            />
          </>
        )}
      </div>
      <div className="mt-3">
        <RotateRow
          rotation={table.rotation}
          onRotate={(rotation) => onPatch({ rotation })}
        />
      </div>
      {warning ? (
        <p className="mt-3 text-sm text-amber-500" role="status">
          ⚠ {warning}
        </p>
      ) : null}
      <h3 className="mt-4 text-sm font-semibold">Guests and meals</h3>
      <ul className="mt-2 grid gap-2">
        {sitting.map((guestId) => {
          const guest = byId.get(guestId)
          if (!guest) return null
          return (
            <li
              key={guestId}
              className="flex flex-wrap items-center justify-between gap-2 text-sm"
            >
              <span>
                <span className="text-[var(--text-faint)]">
                  {(plan.seats[guestId]?.seat ?? 0) + 1}.
                </span>{' '}
                {guest.name}
              </span>
              <span className="flex items-center gap-2">
                <MealTag meal={guest.meal} child={guest.isChild} />
                <button
                  type="button"
                  className="min-h-11 px-1 text-xs text-[var(--pink-soft)]"
                  onClick={() => onSeatGuest(guestId, '')}
                >
                  Unseat
                </button>
              </span>
            </li>
          )
        })}
        {sitting.length === 0 ? (
          <li className="text-sm text-[var(--text-faint)]">No one yet</li>
        ) : null}
      </ul>
      <button
        type="button"
        className="mt-4 min-h-11 text-sm text-[var(--pink-soft)]"
        onClick={onRemove}
      >
        Remove this table
      </button>
    </section>
  )
}

function ItemPanel({
  item,
  unit,
  onPatch,
  onRemove,
  onClose,
}: {
  item: RoomItem
  unit: FloorUnit
  onPatch: (patch: Partial<RoomItem>) => void
  onRemove: () => void
  onClose: () => void
}) {
  const sizeLabel = unit === 'm' ? 'cm' : 'in'
  return (
    <section className="rounded-3xl border border-[var(--pink)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">{item.label || 'Label'}</h2>
        <button
          type="button"
          className="min-h-11 px-2 text-[var(--text-muted)]"
          aria-label="Close item panel"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <label className="text-sm">
          Kind
          <select
            className={`${smallField} mt-1 w-full`}
            value={item.kind}
            onChange={(event) => {
              const kind = event.target.value
              if (!isItemKind(kind)) return
              const base = ROOM_ITEMS.find((entry) => entry.kind === kind)
              const kept = ROOM_ITEMS.some(
                (entry) => entry.label === item.label,
              )
              onPatch({
                kind,
                label: kept && base ? base.label : item.label,
              })
            }}
          >
            {ROOM_ITEMS.map((entry) => (
              <option key={entry.kind} value={entry.kind}>
                {entry.kind === 'label' ? 'Text label' : entry.label}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm">
          Label
          <input
            className={`${smallField} mt-1 w-full`}
            value={item.label}
            maxLength={40}
            onChange={(event) => onPatch({ label: event.target.value })}
          />
        </label>
        <NumberBox
          label={`Length (${sizeLabel})`}
          value={fromInches(item.w, unit, 'table')}
          min={1}
          max={unit === 'm' ? 12000 : 4800}
          onCommit={(value) =>
            onPatch({ w: Math.max(12, Math.round(toInches(value, unit, 'table'))) })
          }
        />
        <NumberBox
          label={`Width (${sizeLabel})`}
          value={fromInches(item.h, unit, 'table')}
          min={1}
          max={unit === 'm' ? 12000 : 4800}
          onCommit={(value) =>
            onPatch({ h: Math.max(6, Math.round(toInches(value, unit, 'table'))) })
          }
        />
      </div>
      <div className="mt-3">
        <RotateRow
          rotation={item.rotation}
          onRotate={(rotation) => onPatch({ rotation })}
        />
      </div>
      <button
        type="button"
        className="mt-4 min-h-11 text-sm text-[var(--pink-soft)]"
        onClick={onRemove}
      >
        Remove from the room
      </button>
    </section>
  )
}

function RoomSettings({
  plan,
  onChange,
  onClose,
}: {
  plan: SeatingPlan
  onChange: (plan: SeatingPlan) => void
  onClose: () => void
}) {
  const unit = plan.room.unit
  const roomUnit = unit === 'm' ? 'm' : 'ft'
  return (
    <section className="mt-3 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
      <div className="flex items-start justify-between gap-2">
        <h2 className="font-semibold">Room size</h2>
        <button
          type="button"
          className="min-h-11 px-2 text-[var(--text-muted)]"
          aria-label="Close room size"
          onClick={onClose}
        >
          ×
        </button>
      </div>
      <p className="mt-1 text-sm text-[var(--text-muted)]">
        Set the room&apos;s inside size so the grid and tables are to scale.
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2">
        <NumberBox
          label={`Width (${roomUnit})`}
          value={fromInches(plan.room.width, unit, 'room')}
          min={unit === 'm' ? 3 : 10}
          max={unit === 'm' ? 120 : 400}
          step={unit === 'm' ? 0.5 : 1}
          onCommit={(value) =>
            onChange(
              resizeRoom(plan, toInches(value, unit, 'room'), plan.room.length),
            )
          }
        />
        <NumberBox
          label={`Length (${roomUnit})`}
          value={fromInches(plan.room.length, unit, 'room')}
          min={unit === 'm' ? 3 : 10}
          max={unit === 'm' ? 120 : 400}
          step={unit === 'm' ? 0.5 : 1}
          onCommit={(value) =>
            onChange(
              resizeRoom(plan, plan.room.width, toInches(value, unit, 'room')),
            )
          }
        />
        <label className="text-sm">
          Units
          <select
            className={`${smallField} mt-1 w-full`}
            value={unit}
            onChange={(event) =>
              onChange({
                ...plan,
                room: {
                  ...plan.room,
                  unit: event.target.value === 'm' ? 'm' : 'ft',
                },
              })
            }
          >
            <option value="ft">Feet</option>
            <option value="m">Metres</option>
          </select>
        </label>
      </div>
    </section>
  )
}

function groupByParty(guests: SeatableGuest[]) {
  const parties = new Map<
    string,
    { id: string; name: string; guests: SeatableGuest[] }
  >()
  for (const guest of guests) {
    const party = parties.get(guest.partyId) ?? {
      id: guest.partyId,
      name: guest.partyName,
      guests: [],
    }
    party.guests.push(guest)
    parties.set(guest.partyId, party)
  }
  return [...parties.values()]
}

function MealTag({ meal, child }: { meal: string; child?: boolean }) {
  return (
    <span className="inline-flex items-center gap-1">
      {child ? (
        <span className="rounded-full border border-[var(--border-strong)] px-2 py-0.5 text-xs text-[var(--text-muted)]">
          Child
        </span>
      ) : null}
      <span className="rounded-full bg-[var(--pink-tint)] px-2 py-0.5 text-xs text-[var(--pink-soft)]">
        {meal || 'No meal chosen'}
      </span>
    </span>
  )
}

function TablePicker({
  plan,
  value,
  label,
  onChange,
}: {
  plan: SeatingPlan
  value: string
  label: string
  onChange: (tableId: string) => void
}) {
  return (
    <select
      className={`${smallField} max-w-[10rem] text-sm`}
      aria-label={label}
      value={value}
      onChange={(event) => onChange(event.target.value)}
    >
      <option value="">{value ? 'Unassigned' : 'Table…'}</option>
      {plan.tables.map((table) => {
        const free = table.seats - guestsAt(plan, table.id).length
        const here = table.id === value
        const full = !here && free <= 0
        return (
          <option key={table.id} value={table.id} disabled={full}>
            {tableLabel(table.name)}
            {here ? '' : full ? ' · full' : ` · ${free} free`}
          </option>
        )
      })}
    </select>
  )
}

function GuestRow({
  guest,
  plan,
  seat,
  picked = false,
  onPick,
  onTable,
}: {
  guest: SeatableGuest
  plan: SeatingPlan
  seat?: number
  picked?: boolean
  onPick?: () => void
  onTable: (tableId: string) => void
}) {
  const [showMeal, setShowMeal] = useState(false)
  const spot = plan.seats[guest.id]
  return (
    <li
      className={`group flex flex-wrap items-center justify-between gap-2 rounded-xl px-2 py-1 ${picked ? 'bg-[var(--pink-tint)]' : ''}`}
      draggable
      onDragStart={(event: DragEvent) => {
        event.dataTransfer.setData('text/x-rsvp-guest', guest.id)
        event.dataTransfer.setData('text/plain', guest.name)
        event.dataTransfer.effectAllowed = 'move'
      }}
    >
      <button
        type="button"
        className="min-h-11 min-w-0 flex-1 cursor-grab text-left text-sm"
        aria-pressed={onPick ? picked : undefined}
        title={guest.meal ? `Meal: ${guest.meal}` : 'No meal chosen yet'}
        onClick={() => {
          setShowMeal((current) => !current)
          onPick?.()
        }}
      >
        <span className="font-semibold">
          {seat ? `${seat}. ` : ''}
          {guest.name}
        </span>
        {guest.isPlusOne ? (
          <span className="text-[var(--text-faint)]"> · plus-one</span>
        ) : null}
        <span
          className={`ml-2 align-middle ${showMeal || picked ? 'inline' : 'hidden group-hover:inline group-focus-within:inline'}`}
        >
          <MealTag meal={guest.meal} child={guest.isChild} />
        </span>
      </button>
      {plan.tables.length > 0 ? (
        <TablePicker
          plan={plan}
          value={spot?.tableId ?? ''}
          label={`Table for ${guest.name}`}
          onChange={onTable}
        />
      ) : null}
    </li>
  )
}

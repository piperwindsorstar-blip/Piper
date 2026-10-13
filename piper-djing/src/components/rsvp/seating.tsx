import { useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useMemo, useRef, useState } from 'react'
import type { DragEvent } from 'react'
import {
  MAX_SEATS,
  MAX_TABLES,
  TABLE_SHAPES,
  addTables,
  assignGuest,
  guestsAt,
  isShape,
  nextTableName,
  nextTableSpot,
  removeTable,
  resizeTable,
  seatParty,
  tableLabel,
  tableNameProblem,
  unseat,
} from '../../lib/rsvp/seating.ts'
import type {
  SeatableGuest,
  SeatingNotice,
  SeatingPlan,
} from '../../lib/rsvp/seating.ts'
import {
  dismissSeatingNotices,
  saveRsvpSeating,
} from '../../lib/rsvp/rsvp.functions.ts'
import type { getRsvpSeating } from '../../lib/rsvp/rsvp.functions.ts'
import { SaveStatus, useAutosave } from './autosave.tsx'
import { FloorPlan } from './floor-plan.tsx'
import { PrintSeating, usePrintSheet } from './print.tsx'
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
  const router = useRouter()
  const [plan, setPlan] = useState<SeatingPlan>(data.plan)
  const [notices, setNotices] = useState<SeatingNotice[]>(data.plan.notices)
  const [problem, setProblem] = useState('')
  const [selected, setSelected] = useState('')
  const [placing, setPlacing] = useState('')
  const [count, setCount] = useState('6')
  const { sheet, print } = usePrintSheet()
  const planRef = useRef(plan)
  planRef.current = plan

  const guests: SeatableGuest[] = data.guests
  const byId = useMemo(
    () => new Map(guests.map((guest) => [guest.id, guest])),
    [guests],
  )
  const seatedCount = guests.filter((guest) => plan.seats[guest.id]).length

  const autosave = useAutosave<SeatingPlan>(async (draft) => {
    const result = await save({
      data: { tables: draft.tables, seats: draft.seats },
    })
    if (!result.ok) return { ok: false, error: result.error }
    return { ok: true }
  })

  /** Every change goes through here: checked, shown, then saved shortly. */
  function commit(next: SeatingPlan, now = false) {
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

  function change(result: { ok: true; plan: SeatingPlan } | { ok: false; error: string }) {
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

  const unassigned = guests.filter((guest) => !plan.seats[guest.id])
  const parties = groupByParty(unassigned)
  const selectedGuest = selected ? byId.get(selected) : undefined
  const selectedSpot = selected ? plan.seats[selected] : undefined
  const selectedTable = selectedSpot
    ? plan.tables.find((table) => table.id === selectedSpot.tableId)
    : undefined

  return (
    <div>
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
              onClick={() => print('seating')}
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

        <section className="mt-4 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4">
          <h2 className="font-semibold">Tables</h2>
          {plan.tables.length === 0 ? (
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
                Each starts as a round table for 8. Change the number or name,
                shape and seats after.
              </p>
            </div>
          ) : (
            <ul className="mt-3 grid gap-2">
              {plan.tables.map((table, index) => {
                const sitting = guestsAt(plan, table.id).length
                return (
                  <li
                    key={table.id}
                    className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2 rounded-2xl border border-[var(--border)] p-3 sm:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)_6rem_auto_auto]"
                  >
                    <label className="col-span-2 text-sm sm:col-span-1">
                      Table number or name
                      <input
                        className={`${smallField} mt-1 w-full`}
                        value={table.name}
                        maxLength={30}
                        aria-label={`Table ${index + 1} number or name`}
                        onChange={(event) => {
                          const name = event.target.value
                          commit({
                            ...planRef.current,
                            tables: planRef.current.tables.map((item) =>
                              item.id === table.id ? { ...item, name } : item,
                            ),
                          })
                        }}
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
                          commit({
                            ...planRef.current,
                            tables: planRef.current.tables.map((item) =>
                              item.id === table.id ? { ...item, shape } : item,
                            ),
                          })
                        }}
                      >
                        {TABLE_SHAPES.map((shape) => (
                          <option key={shape.id} value={shape.id}>
                            {shape.label}
                          </option>
                        ))}
                      </select>
                    </label>
                    <label className="text-sm">
                      Seats
                      <input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        max={MAX_SEATS}
                        className={`${smallField} mt-1 w-full`}
                        value={table.seats}
                        onChange={(event) => {
                          const seats = Number(event.target.value)
                          if (!Number.isFinite(seats) || seats < 1) return
                          change(resizeTable(planRef.current, table.id, seats))
                        }}
                      />
                    </label>
                    <span className="self-center pb-1 text-xs text-[var(--text-faint)] sm:text-sm">
                      {sitting} / {table.seats}
                    </span>
                    <button
                      type="button"
                      className={iconButton}
                      aria-label={`Remove ${tableLabel(table.name)}`}
                      onClick={() => {
                        const message =
                          sitting > 0
                            ? `Remove ${tableLabel(table.name)}? The ${sitting} guest${sitting === 1 ? '' : 's'} seated there go back to Unassigned.`
                            : `Remove ${tableLabel(table.name)}?`
                        if (!window.confirm(message)) return
                        commit(removeTable(planRef.current, table.id), true)
                      }}
                    >
                      ×
                    </button>
                  </li>
                )
              })}
            </ul>
          )}
          {plan.tables.length > 0 ? (
            <button
              type="button"
              className={`${rsvpGhost} mt-3 w-auto`}
              disabled={plan.tables.length >= MAX_TABLES}
              onClick={() => {
                const current = planRef.current
                const spot = nextTableSpot(current.tables)
                commit(
                  {
                    ...current,
                    tables: [
                      ...current.tables,
                      {
                        id: newId(),
                        name: nextTableName(current.tables),
                        shape: 'round',
                        seats: 8,
                        x: spot.x,
                        y: spot.y,
                      },
                    ],
                  },
                  true,
                )
              }}
            >
              + Add table
            </button>
          ) : null}
        </section>

        <div className="mt-4 grid gap-4 lg:grid-cols-[300px_minmax(0,1fr)]">
          <section className="order-2 rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-4 lg:order-1">
            <h2 className="font-semibold">
              Unassigned guests{' '}
              <span className="text-[var(--text-muted)]">
                ({unassigned.length})
              </span>
            </h2>
            <p className="mt-1 text-sm text-[var(--text-muted)]">
              Drag a guest onto a table or seat, or pick a table beside their
              name. Tap a name, then tap an empty seat.
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
                        {plan.tables.map((table) => (
                          <option key={table.id} value={table.id}>
                            {tableLabel(table.name)} (
                            {table.seats - guestsAt(plan, table.id).length}{' '}
                            free)
                          </option>
                        ))}
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

          <section className="order-1 min-w-0 lg:order-2">
            <div className="rounded-3xl border border-[var(--border)] bg-[var(--surface)] p-2">
              {plan.tables.length === 0 ? (
                <p className="grid min-h-48 place-items-center p-6 text-center text-sm text-[var(--text-muted)]">
                  Create your tables to see the room.
                </p>
              ) : (
                <div className="overflow-x-auto">
                  <div className="min-w-[640px]">
                    <FloorPlan
                      plan={plan}
                      guests={byId}
                      selectedGuest={selected}
                      placing={placing !== ''}
                      onMoveTable={(tableId, x, y) => {
                        const next = {
                          ...planRef.current,
                          tables: planRef.current.tables.map((table) =>
                            table.id === tableId ? { ...table, x, y } : table,
                          ),
                        }
                        planRef.current = next
                        setPlan(next)
                      }}
                      onMoveEnd={() => commit(planRef.current)}
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
                </div>
              )}
            </div>
            <p className="mt-2 text-xs text-[var(--text-faint)]">
              Drag a table to arrange the room. Tap a seat to see who is there.
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
                  <MealTag meal={selectedGuest.meal} child={selectedGuest.isChild} />
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
                      <span>{tableLabel(table.name)}</span>
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
          <button
            type="button"
            className={`${rsvpButton} w-auto`}
            onClick={() => {
              const names = tableNameProblem(planRef.current.tables)
              if (names) {
                autosave.hold(names)
                return
              }
              autosave.flush(planRef.current)
              void router.invalidate()
            }}
          >
            Save now
          </button>
          <SaveStatus phase={autosave.phase} error={autosave.error} />
        </div>
      </div>
      {sheet === 'seating' ? (
        <div className="hidden print:block">
          <PrintSeating
            plan={plan}
            guests={guests}
            couple={data.couple}
            dateLabel={data.dateLabel}
          />
        </div>
      ) : null}
    </div>
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
        return (
          <option key={table.id} value={table.id}>
            {tableLabel(table.name)}
            {table.id === value ? '' : ` (${free} free)`}
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

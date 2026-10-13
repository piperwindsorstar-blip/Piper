/**
 * The couple's seating chart: the tables on the floor plan and who sits where.
 * Pure rules only, so the dashboard, the server and the CSV all agree.
 *
 * Only a guest whose RSVP is confirmed attending can be seated. A guest who
 * later says they can't make it comes off their seat on the next load, and the
 * couple sees a notice saying so.
 */

import { foldName, guestOutcome, invitedEvents, replyFor, toCsv } from './model.ts'
import type { RsvpWedding } from './model.ts'

export type TableShape = 'round' | 'rectangle' | 'square' | 'banquet'

export const TABLE_SHAPES: { id: TableShape; label: string }[] = [
  { id: 'round', label: 'Round' },
  { id: 'rectangle', label: 'Rectangle' },
  { id: 'square', label: 'Square' },
  { id: 'banquet', label: 'Long banquet' },
]

export type SeatTable = {
  id: string
  /** "1", "2", "Head table". Unique on the plan. */
  name: string
  shape: TableShape
  seats: number
  /** Centre of the table on the floor plan, in floor units. */
  x: number
  y: number
}

export type SeatSpot = { tableId: string; seat: number }

export type SeatingNotice = { id: string; text: string; at: string }

export type SeatingPlan = {
  tables: SeatTable[]
  /** Guest id → table and seat number (0-based). */
  seats: Record<string, SeatSpot>
  notices: SeatingNotice[]
}

export const FLOOR_W = 1000
export const FLOOR_H = 700
export const MAX_TABLES = 60
export const MAX_SEATS = 30
export const DEFAULT_SEATS = 8
const MAX_NOTICES = 20

export type SeatableGuest = {
  id: string
  name: string
  firstName: string
  partyId: string
  partyName: string
  isChild: boolean
  isPlusOne: boolean
  meal: string
  events: string[]
}

export function emptySeating(): SeatingPlan {
  return { tables: [], seats: {}, notices: [] }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null
  return value as Record<string, unknown>
}

function asText(value: unknown, max: number): string {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function asNumber(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(number) ? number : fallback
}

function clamp(value: number, low: number, high: number): number {
  return Math.min(high, Math.max(low, value))
}

export function isShape(value: unknown): value is TableShape {
  return (
    value === 'round' ||
    value === 'rectangle' ||
    value === 'square' ||
    value === 'banquet'
  )
}

/** Reads a stored or posted plan, dropping anything malformed. */
export function parseSeating(raw: unknown): SeatingPlan {
  const record = asRecord(raw)
  if (!record) return emptySeating()
  const tables: SeatTable[] = []
  const ids = new Set<string>()
  if (Array.isArray(record.tables)) {
    for (const item of record.tables) {
      const table = asRecord(item)
      if (!table) continue
      const id = asText(table.id, 40)
      if (!id || ids.has(id)) continue
      ids.add(id)
      tables.push({
        id,
        name: asText(table.name, 30),
        shape: isShape(table.shape) ? table.shape : 'round',
        seats: clamp(Math.round(asNumber(table.seats, DEFAULT_SEATS)), 1, MAX_SEATS),
        x: clamp(Math.round(asNumber(table.x, FLOOR_W / 2)), 0, FLOOR_W),
        y: clamp(Math.round(asNumber(table.y, FLOOR_H / 2)), 0, FLOOR_H),
      })
      if (tables.length >= MAX_TABLES) break
    }
  }
  const seats: Record<string, SeatSpot> = {}
  const seatRecord = asRecord(record.seats)
  if (seatRecord) {
    for (const [guestId, value] of Object.entries(seatRecord)) {
      const spot = asRecord(value)
      if (!spot) continue
      const tableId = asText(spot.tableId, 40)
      const seat = Math.round(asNumber(spot.seat, -1))
      if (!tableId || seat < 0) continue
      seats[guestId.slice(0, 40)] = { tableId, seat }
    }
  }
  const notices: SeatingNotice[] = []
  if (Array.isArray(record.notices)) {
    for (const item of record.notices) {
      const notice = asRecord(item)
      if (!notice) continue
      const text = asText(notice.text, 240)
      if (!text) continue
      notices.push({
        id: asText(notice.id, 40) || text.slice(0, 40),
        text,
        at: asText(notice.at, 40),
      })
      if (notices.length >= MAX_NOTICES) break
    }
  }
  return { tables, seats, notices }
}

/** "1" reads as "Table 1"; "Head table" stays as it is. */
export function tableLabel(name: string): string {
  const clean = name.trim()
  if (!clean) return 'Table'
  return /^\d+$/.test(clean) ? `Table ${clean}` : clean
}

/**
 * Everyone who can take a seat: guests whose RSVP is confirmed attending,
 * named plus-ones included. Waiting and declined guests are left out.
 */
export function seatableGuests(wedding: RsvpWedding): SeatableGuest[] {
  const guests: SeatableGuest[] = []
  for (const party of wedding.parties) {
    for (const guest of party.guests) {
      if (guestOutcome(guest, party) !== 'attending') continue
      const name = `${guest.firstName} ${guest.lastName}`.trim()
      if (!name) continue
      guests.push({
        id: guest.id,
        name,
        firstName: guest.firstName,
        partyId: party.id,
        partyName: party.name,
        isChild: guest.isChild,
        isPlusOne: guest.isPlusOne,
        meal: guest.meal,
        events: invitedEvents(wedding, party)
          .filter((event) => replyFor(guest, event.id) === 'attending')
          .map((event) => event.name),
      })
    }
  }
  return guests
}

/** Table footprint in floor units, so seats and labels never overlap it. */
export function tableSize(
  shape: TableShape,
  seats: number,
): { w: number; h: number } {
  if (shape === 'round') {
    const d = Math.max(64, Math.round(seats * 11))
    return { w: d, h: d }
  }
  if (shape === 'square') {
    const side = Math.max(70, Math.ceil(seats / 4) * 34)
    return { w: side, h: side }
  }
  if (shape === 'rectangle') {
    return { w: Math.max(96, Math.ceil(seats / 2) * 34), h: 58 }
  }
  const oneSide = seats <= 12
  return {
    w: Math.max(120, (oneSide ? seats : Math.ceil(seats / 2)) * 34),
    h: 44,
  }
}

const SEAT_GAP = 22

/** Where each seat sits around its table, relative to the table's centre. */
export function seatPositions(
  shape: TableShape,
  seats: number,
): { x: number; y: number }[] {
  const { w, h } = tableSize(shape, seats)
  if (shape === 'round') {
    const r = w / 2 + SEAT_GAP
    return Array.from({ length: seats }, (_, index) => {
      const angle = -Math.PI / 2 + (index / seats) * Math.PI * 2
      return { x: Math.cos(angle) * r, y: Math.sin(angle) * r }
    })
  }
  const along = (count: number, length: number) =>
    Array.from(
      { length: count },
      (_, index) => -length / 2 + (length / count) * (index + 0.5),
    )
  if (shape === 'square') {
    const sides = [0, 0, 0, 0]
    for (let index = 0; index < seats; index += 1) sides[index % 4] += 1
    const [top = 0, right = 0, bottom = 0, left = 0] = sides
    return [
      ...along(top, w).map((x) => ({ x, y: -h / 2 - SEAT_GAP })),
      ...along(right, h).map((y) => ({ x: w / 2 + SEAT_GAP, y })),
      ...along(bottom, w)
        .reverse()
        .map((x) => ({ x, y: h / 2 + SEAT_GAP })),
      ...along(left, h)
        .reverse()
        .map((y) => ({ x: -w / 2 - SEAT_GAP, y })),
    ]
  }
  if (shape === 'banquet' && seats <= 12) {
    // A head table faces the room: everyone sits along the back.
    return along(seats, w).map((x) => ({ x, y: -h / 2 - SEAT_GAP }))
  }
  const top = Math.ceil(seats / 2)
  const bottom = seats - top
  return [
    ...along(top, w).map((x) => ({ x, y: -h / 2 - SEAT_GAP })),
    ...along(bottom, w).map((x) => ({ x, y: h / 2 + SEAT_GAP })),
  ]
}

/** The smallest table number not already on the plan. */
export function nextTableName(tables: SeatTable[]): string {
  const taken = new Set(tables.map((table) => foldName(table.name)))
  for (let number = 1; number <= MAX_TABLES * 2; number += 1) {
    if (!taken.has(String(number))) return String(number)
  }
  return `Table ${tables.length + 1}`
}

/** An open spot on the floor for a new table, in a tidy grid. */
export function nextTableSpot(tables: SeatTable[]): { x: number; y: number } {
  const columns = 4
  const cellW = FLOOR_W / columns
  const cellH = 175
  for (let index = 0; index < MAX_TABLES; index += 1) {
    const x = Math.round(cellW * ((index % columns) + 0.5))
    const y = Math.round(110 + cellH * Math.floor(index / columns))
    const free = tables.every(
      (table) => Math.abs(table.x - x) > 60 || Math.abs(table.y - y) > 60,
    )
    if (free) return { x, y: Math.min(y, FLOOR_H - 60) }
  }
  return { x: FLOOR_W / 2, y: FLOOR_H / 2 }
}

export function addTables(
  plan: SeatingPlan,
  count: number,
  makeId: () => string,
): SeatingPlan {
  const tables = plan.tables.slice()
  const wanted = clamp(Math.round(count), 0, MAX_TABLES - tables.length)
  for (let index = 0; index < wanted; index += 1) {
    const spot = nextTableSpot(tables)
    tables.push({
      id: makeId(),
      name: nextTableName(tables),
      shape: 'round',
      seats: DEFAULT_SEATS,
      x: spot.x,
      y: spot.y,
    })
  }
  return { ...plan, tables }
}

/** Removing a table sends everyone at it back to Unassigned. */
export function removeTable(plan: SeatingPlan, tableId: string): SeatingPlan {
  const seats: Record<string, SeatSpot> = {}
  for (const [guestId, spot] of Object.entries(plan.seats)) {
    if (spot.tableId !== tableId) seats[guestId] = spot
  }
  return {
    ...plan,
    tables: plan.tables.filter((table) => table.id !== tableId),
    seats,
  }
}

export function guestsAt(plan: SeatingPlan, tableId: string): string[] {
  return Object.entries(plan.seats)
    .filter(([, spot]) => spot.tableId === tableId)
    .sort((a, b) => a[1].seat - b[1].seat)
    .map(([guestId]) => guestId)
}

function freeSeats(plan: SeatingPlan, table: SeatTable, ignore: Set<string>) {
  const used = new Set(
    Object.entries(plan.seats)
      .filter(([guestId, spot]) => spot.tableId === table.id && !ignore.has(guestId))
      .map(([, spot]) => spot.seat),
  )
  const free: number[] = []
  for (let seat = 0; seat < table.seats; seat += 1) {
    if (!used.has(seat)) free.push(seat)
  }
  return free
}

type Change = { ok: true; plan: SeatingPlan } | { ok: false; error: string }

/**
 * Seats one guest. With `seat`, that exact seat; otherwise the first free one.
 * A full table refuses with a message that says so.
 */
export function assignGuest(
  plan: SeatingPlan,
  guestId: string,
  tableId: string,
  seat?: number,
): Change {
  const table = plan.tables.find((item) => item.id === tableId)
  if (!table) return { ok: false, error: 'That table is not on the plan.' }
  const current = plan.seats[guestId]
  const free = freeSeats(plan, table, new Set([guestId]))
  if (seat !== undefined) {
    if (seat < 0 || seat >= table.seats) {
      return { ok: false, error: `${tableLabel(table.name)} has no seat ${seat + 1}.` }
    }
    if (!free.includes(seat)) {
      return {
        ok: false,
        error: `Seat ${seat + 1} at ${tableLabel(table.name)} is taken. Choose an empty seat.`,
      }
    }
  }
  if (current?.tableId === tableId && seat === undefined) return { ok: true, plan }
  const chosen = seat ?? free[0]
  if (chosen === undefined) {
    return {
      ok: false,
      error: `${tableLabel(table.name)} is full (${table.seats} of ${table.seats} seats). Add a seat or choose another table.`,
    }
  }
  return {
    ok: true,
    plan: { ...plan, seats: { ...plan.seats, [guestId]: { tableId, seat: chosen } } },
  }
}

/** Seats a whole party together, or refuses if the table cannot hold them all. */
export function seatParty(
  plan: SeatingPlan,
  guestIds: string[],
  tableId: string,
): Change {
  const table = plan.tables.find((item) => item.id === tableId)
  if (!table) return { ok: false, error: 'That table is not on the plan.' }
  const moving = guestIds.filter((id) => plan.seats[id]?.tableId !== tableId)
  const free = freeSeats(plan, table, new Set(moving))
  if (moving.length > free.length) {
    const left = free.length
    return {
      ok: false,
      error: `${tableLabel(table.name)} has ${left} free seat${left === 1 ? '' : 's'}, and this party needs ${moving.length}. Add seats or choose another table.`,
    }
  }
  const seats = { ...plan.seats }
  moving.forEach((guestId, index) => {
    seats[guestId] = { tableId, seat: free[index] ?? 0 }
  })
  return { ok: true, plan: { ...plan, seats } }
}

export function unseat(plan: SeatingPlan, guestId: string): SeatingPlan {
  if (!plan.seats[guestId]) return plan
  const seats = { ...plan.seats }
  delete seats[guestId]
  return { ...plan, seats }
}

/**
 * Changes a table's seat count. Guests sitting past the new last seat move to
 * the free seats that remain; if there are none, the change is refused.
 */
export function resizeTable(
  plan: SeatingPlan,
  tableId: string,
  seats: number,
): Change {
  const table = plan.tables.find((item) => item.id === tableId)
  if (!table) return { ok: false, error: 'That table is not on the plan.' }
  const size = clamp(Math.round(seats), 1, MAX_SEATS)
  const sitting = guestsAt(plan, tableId)
  if (sitting.length > size) {
    return {
      ok: false,
      error: `${sitting.length} guests sit at ${tableLabel(table.name)}. Move ${sitting.length - size} before making it ${size} seat${size === 1 ? '' : 's'}.`,
    }
  }
  const next: SeatingPlan = {
    ...plan,
    tables: plan.tables.map((item) =>
      item.id === tableId ? { ...item, seats: size } : item,
    ),
    seats: { ...plan.seats },
  }
  const used = new Set(
    sitting.map((id) => plan.seats[id]?.seat ?? -1).filter((seat) => seat < size),
  )
  const open = Array.from({ length: size }, (_, seat) => seat).filter(
    (seat) => !used.has(seat),
  )
  for (const guestId of sitting) {
    const spot = next.seats[guestId]
    if (spot && spot.seat >= size) {
      next.seats[guestId] = { tableId, seat: open.shift() ?? 0 }
    }
  }
  return { ok: true, plan: next }
}

/** Table names are required and must be unique (case and spacing ignored). */
export function tableNameProblem(tables: SeatTable[]): string {
  const seen = new Map<string, string>()
  for (const table of tables) {
    const name = table.name.trim()
    if (!name) return 'Every table needs a number or name.'
    const key = foldName(name) || name.toLowerCase()
    const before = seen.get(key)
    if (before !== undefined) {
      return `Two tables are called "${name}". Table numbers must be unique.`
    }
    seen.set(key, name)
  }
  return ''
}

/**
 * Checks a plan the couple posted. Seats must point at real tables and real
 * seats, one guest per seat, and only guests confirmed attending.
 */
export function validateSeating(
  plan: SeatingPlan,
  wedding: RsvpWedding,
): { ok: true; plan: SeatingPlan } | { ok: false; error: string } {
  if (plan.tables.length > MAX_TABLES) {
    return { ok: false, error: `Up to ${MAX_TABLES} tables fit on one plan.` }
  }
  const problem = tableNameProblem(plan.tables)
  if (problem) return { ok: false, error: problem }
  const tables = new Map(plan.tables.map((table) => [table.id, table]))
  const guests = new Map(seatableGuests(wedding).map((guest) => [guest.id, guest]))
  const taken = new Set<string>()
  const counts = new Map<string, number>()
  const seats: Record<string, SeatSpot> = {}
  for (const [guestId, spot] of Object.entries(plan.seats)) {
    const table = tables.get(spot.tableId)
    // A guest who stopped attending since the page loaded simply drops off.
    if (!table || !guests.has(guestId)) continue
    const count = (counts.get(table.id) ?? 0) + 1
    counts.set(table.id, count)
    if (count > table.seats) {
      return {
        ok: false,
        error: `${tableLabel(table.name)} has ${table.seats} seats and ${count} guests. Move someone first.`,
      }
    }
    if (spot.seat >= table.seats) {
      return {
        ok: false,
        error: `${tableLabel(table.name)} has no seat ${spot.seat + 1}.`,
      }
    }
    const key = `${spot.tableId}#${spot.seat}`
    if (taken.has(key)) {
      return {
        ok: false,
        error: `Two guests are in seat ${spot.seat + 1} at ${tableLabel(table.name)}.`,
      }
    }
    taken.add(key)
    seats[guestId] = spot
  }
  return {
    ok: true,
    plan: {
      tables: plan.tables.map((table) => ({ ...table, name: table.name.trim() })),
      seats,
      notices: plan.notices,
    },
  }
}

/**
 * Takes anyone who is no longer confirmed attending off their seat, with a
 * notice for the couple. Returns whether anything changed so the caller knows
 * to save.
 */
export function pruneSeating(
  plan: SeatingPlan,
  wedding: RsvpWedding,
  now: string,
  makeId: () => string,
): { plan: SeatingPlan; changed: boolean } {
  const attending = new Set(seatableGuests(wedding).map((guest) => guest.id))
  const tables = new Map(plan.tables.map((table) => [table.id, table]))
  const people = new Map<string, { name: string; declined: boolean }>()
  for (const party of wedding.parties) {
    for (const guest of party.guests) {
      people.set(guest.id, {
        name: `${guest.firstName} ${guest.lastName}`.trim() || 'A guest',
        declined: guestOutcome(guest, party) === 'declined',
      })
    }
  }
  const seats: Record<string, SeatSpot> = {}
  const notices: SeatingNotice[] = []
  let changed = false
  const used = new Set<string>()
  for (const [guestId, spot] of Object.entries(plan.seats)) {
    const table = tables.get(spot.tableId)
    const key = `${spot.tableId}#${spot.seat}`
    if (!table || spot.seat >= table.seats || used.has(key)) {
      changed = true
      continue
    }
    if (!attending.has(guestId)) {
      changed = true
      const person = people.get(guestId)
      const where = tableLabel(table.name)
      notices.push({
        id: makeId(),
        at: now,
        text: !person
          ? `A guest who is no longer on the list was taken off ${where}.`
          : person.declined
            ? `${person.name} changed their RSVP to "Can't make it" and was taken off ${where}.`
            : `${person.name} is no longer confirmed and was taken off ${where}.`,
      })
      continue
    }
    used.add(key)
    seats[guestId] = spot
  }
  if (!changed) return { plan, changed: false }
  return {
    plan: {
      ...plan,
      seats,
      notices: [...notices, ...plan.notices].slice(0, MAX_NOTICES),
    },
    changed: true,
  }
}

/** Tables in plan order, with each table's guests in seat order. */
export function seatingRows(
  plan: SeatingPlan,
  wedding: RsvpWedding,
): {
  table: SeatTable
  guests: { seat: number; guest: SeatableGuest }[]
}[] {
  const guests = new Map(seatableGuests(wedding).map((guest) => [guest.id, guest]))
  return plan.tables.map((table) => ({
    table,
    guests: guestsAt(plan, table.id).flatMap((guestId) => {
      const guest = guests.get(guestId)
      const spot = plan.seats[guestId]
      return guest && spot ? [{ seat: spot.seat, guest }] : []
    }),
  }))
}

/**
 * The seating chart for the venue: Table, Seat, Party, Guest, Child, Meal,
 * Event. Confirmed guests without a seat come last with the table left blank.
 */
export function seatingChartCsv(plan: SeatingPlan, wedding: RsvpWedding): string {
  const rows = [['Table', 'Seat', 'Party', 'Guest', 'Child', 'Meal', 'Event']]
  const seated = new Set<string>()
  for (const { table, guests } of seatingRows(plan, wedding)) {
    for (const { seat, guest } of guests) {
      seated.add(guest.id)
      rows.push([
        table.name,
        String(seat + 1),
        guest.partyName,
        guest.name,
        guest.isChild ? 'yes' : '',
        guest.meal,
        guest.events.join('; '),
      ])
    }
  }
  for (const guest of seatableGuests(wedding)) {
    if (seated.has(guest.id)) continue
    rows.push([
      '',
      '',
      guest.partyName,
      guest.name,
      guest.isChild ? 'yes' : '',
      guest.meal,
      guest.events.join('; '),
    ])
  }
  return toCsv(rows)
}

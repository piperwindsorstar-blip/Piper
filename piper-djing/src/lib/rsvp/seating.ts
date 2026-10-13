/**
 * The couple's seating chart: the room, the tables on its floor plan, the
 * other things in the room (dance floor, DJ booth, bar…) and who sits where.
 * Pure rules only, so the dashboard, the server and the CSV all agree.
 *
 * Floor units are inches, so a 60″ round table is 60 units across and the grid
 * can be drawn to scale in feet or metres.
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
  /** Centre of the table on the floor plan, in inches from the room's corner. */
  x: number
  y: number
  /** Size in inches. A round table uses w as its diameter. */
  w: number
  h: number
  /** Degrees clockwise. */
  rotation: number
}

export type RoomItemKind =
  | 'dance-floor'
  | 'dj-booth'
  | 'head-table'
  | 'cake'
  | 'gift'
  | 'bar'
  | 'buffet'
  | 'photo'
  | 'door'
  | 'label'

/** Something in the room that is not a seated table. */
export type RoomItem = {
  id: string
  kind: RoomItemKind
  label: string
  x: number
  y: number
  w: number
  h: number
  rotation: number
}

export type FloorUnit = 'ft' | 'm'

export type FloorRoom = {
  /** Inside size of the room, in inches. */
  width: number
  length: number
  /** How sizes are shown and typed. Stored values stay in inches. */
  unit: FloorUnit
  /** Dragging snaps to the grid. */
  snap: boolean
}

export type SeatSpot = { tableId: string; seat: number }

export type SeatingNotice = { id: string; text: string; at: string }

export type SeatingPlan = {
  room: FloorRoom
  tables: SeatTable[]
  items: RoomItem[]
  /** Guest id → table and seat number (0-based). */
  seats: Record<string, SeatSpot>
  notices: SeatingNotice[]
}

export const INCHES_PER_FOOT = 12
export const INCHES_PER_METRE = 39.37
/** 84 ft × 60 ft: room for a typical reception before the couple sets theirs. */
export const DEFAULT_ROOM_W = 84 * INCHES_PER_FOOT
export const DEFAULT_ROOM_L = 60 * INCHES_PER_FOOT
export const MIN_ROOM = 10 * INCHES_PER_FOOT
export const MAX_ROOM = 400 * INCHES_PER_FOOT
/** Kept for older callers: the default room in floor units. */
export const FLOOR_W = DEFAULT_ROOM_W
export const FLOOR_H = DEFAULT_ROOM_L
export const MAX_TABLES = 60
export const MAX_ITEMS = 60
export const MAX_SEATS = 30
export const DEFAULT_SEATS = 8
export const MIN_SIZE = 12
export const MAX_SIZE = 600
/** Seats closer than this, centre to centre, are drawn but flagged as tight. */
export const SEAT_ROOM = 22
const MAX_NOTICES = 20

export const ROOM_ITEMS: {
  kind: RoomItemKind
  label: string
  w: number
  h: number
}[] = [
  { kind: 'dance-floor', label: 'Dance floor', w: 192, h: 192 },
  { kind: 'dj-booth', label: 'DJ Piper P', w: 96, h: 36 },
  { kind: 'head-table', label: 'Head table', w: 144, h: 36 },
  { kind: 'cake', label: 'Cake table', w: 48, h: 48 },
  { kind: 'gift', label: 'Gift table', w: 72, h: 30 },
  { kind: 'bar', label: 'Bar', w: 120, h: 36 },
  { kind: 'buffet', label: 'Buffet', w: 144, h: 36 },
  { kind: 'photo', label: 'Photo area', w: 96, h: 96 },
  { kind: 'door', label: 'Entrance', w: 60, h: 12 },
  { kind: 'label', label: 'Label', w: 96, h: 24 },
]

export function roomItemDefaults(kind: RoomItemKind) {
  return ROOM_ITEMS.find((item) => item.kind === kind) ?? ROOM_ITEMS[9]!
}

export function isItemKind(value: unknown): value is RoomItemKind {
  return ROOM_ITEMS.some((item) => item.kind === value)
}

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

export function defaultRoom(): FloorRoom {
  return {
    width: DEFAULT_ROOM_W,
    length: DEFAULT_ROOM_L,
    unit: 'ft',
    snap: true,
  }
}

/** The DJ booth every plan starts with, along the top wall. */
export function defaultItems(room: FloorRoom = defaultRoom()): RoomItem[] {
  const booth = roomItemDefaults('dj-booth')
  return [
    {
      id: 'dj-booth',
      kind: 'dj-booth',
      label: booth.label,
      x: Math.round(room.width / 2),
      y: Math.round(booth.h / 2 + 24),
      w: booth.w,
      h: booth.h,
      rotation: 0,
    },
  ]
}

export function emptySeating(): SeatingPlan {
  const room = defaultRoom()
  return {
    room,
    tables: [],
    items: defaultItems(room),
    seats: {},
    notices: [],
  }
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

/** Any angle as 0–359 degrees. */
export function normalAngle(degrees: number): number {
  const whole = Math.round(degrees) % 360
  return whole < 0 ? whole + 360 : whole
}

export function isShape(value: unknown): value is TableShape {
  return (
    value === 'round' ||
    value === 'rectangle' ||
    value === 'square' ||
    value === 'banquet'
  )
}

function parseRoom(value: unknown): FloorRoom {
  const room = asRecord(value)
  const base = defaultRoom()
  if (!room) return base
  return {
    width: clamp(Math.round(asNumber(room.width, base.width)), MIN_ROOM, MAX_ROOM),
    length: clamp(
      Math.round(asNumber(room.length, base.length)),
      MIN_ROOM,
      MAX_ROOM,
    ),
    unit: room.unit === 'm' ? 'm' : 'ft',
    snap: room.snap !== false,
  }
}

/** Width and length for a table, square or round kept even. */
export function fitTableSize(
  shape: TableShape,
  w: number,
  h: number,
): { w: number; h: number } {
  const width = clamp(Math.round(w), MIN_SIZE, MAX_SIZE)
  const height = clamp(Math.round(h), MIN_SIZE, MAX_SIZE)
  if (shape === 'round' || shape === 'square') {
    return { w: width, h: width }
  }
  return { w: width, h: height }
}

/** Reads a stored or posted plan, dropping anything malformed. */
export function parseSeating(raw: unknown): SeatingPlan {
  const record = asRecord(raw)
  if (!record) return emptySeating()
  const room = parseRoom(record.room)
  const tables: SeatTable[] = []
  const ids = new Set<string>()
  if (Array.isArray(record.tables)) {
    for (const item of record.tables) {
      const table = asRecord(item)
      if (!table) continue
      const id = asText(table.id, 40)
      if (!id || ids.has(id)) continue
      ids.add(id)
      const shape = isShape(table.shape) ? table.shape : 'round'
      const seats = clamp(
        Math.round(asNumber(table.seats, DEFAULT_SEATS)),
        1,
        MAX_SEATS,
      )
      const auto = tableSize(shape, seats)
      const size = fitTableSize(
        shape,
        asNumber(table.w, auto.w),
        asNumber(table.h, auto.h),
      )
      tables.push({
        id,
        name: asText(table.name, 30),
        shape,
        seats,
        x: clamp(Math.round(asNumber(table.x, room.width / 2)), 0, room.width),
        y: clamp(Math.round(asNumber(table.y, room.length / 2)), 0, room.length),
        w: size.w,
        h: size.h,
        rotation: normalAngle(asNumber(table.rotation, 0)),
      })
      if (tables.length >= MAX_TABLES) break
    }
  }
  const items: RoomItem[] = []
  if (!Array.isArray(record.items)) {
    // A plan saved before room items existed starts with the DJ booth.
    items.push(...defaultItems(room))
  } else {
    const itemIds = new Set<string>()
    for (const value of record.items) {
      const item = asRecord(value)
      if (!item) continue
      const id = asText(item.id, 40)
      if (!id || itemIds.has(id)) continue
      itemIds.add(id)
      const kind = isItemKind(item.kind) ? item.kind : 'label'
      const base = roomItemDefaults(kind)
      items.push({
        id,
        kind,
        label: asText(item.label, 40) || (kind === 'label' ? '' : base.label),
        x: clamp(Math.round(asNumber(item.x, room.width / 2)), 0, room.width),
        y: clamp(Math.round(asNumber(item.y, room.length / 2)), 0, room.length),
        w: clamp(Math.round(asNumber(item.w, base.w)), MIN_SIZE, MAX_ROOM),
        h: clamp(Math.round(asNumber(item.h, base.h)), MIN_SIZE / 2, MAX_ROOM),
        rotation: normalAngle(asNumber(item.rotation, 0)),
      })
      if (items.length >= MAX_ITEMS) break
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
  return { room, tables, items, seats, notices }
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

/** The starting size for a new table of this shape and seat count, in inches. */
export function tableSize(
  shape: TableShape,
  seats: number,
): { w: number; h: number } {
  if (shape === 'round') {
    const d = Math.max(60, Math.round(seats * 9))
    return { w: d, h: d }
  }
  if (shape === 'square') {
    const side = Math.max(60, Math.ceil(seats / 4) * 30)
    return { w: side, h: side }
  }
  if (shape === 'rectangle') {
    return { w: Math.max(72, Math.ceil(seats / 2) * 30), h: 36 }
  }
  const oneSide = seats <= 12
  return {
    w: Math.max(96, (oneSide ? seats : Math.ceil(seats / 2)) * 30),
    h: 30,
  }
}

/** A table's own size, or its starting size for one saved without one. */
export function tableDims(table: {
  shape: TableShape
  seats: number
  w?: number
  h?: number
}): { w: number; h: number } {
  if (table.w && table.h) return fitTableSize(table.shape, table.w, table.h)
  return tableSize(table.shape, table.seats)
}

const SEAT_GAP = 20

/**
 * Where each seat sits around its table, relative to the table's centre and
 * before the table's rotation. Seats spread evenly along the table's edges,
 * so they redraw whenever the size or the seat count changes.
 */
export function seatPositions(
  shape: TableShape,
  seats: number,
  width?: number,
  height?: number,
): { x: number; y: number }[] {
  const auto = tableSize(shape, seats)
  const w = width ?? auto.w
  const h = shape === 'round' || shape === 'square' ? w : (height ?? auto.h)
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

/** Turns a point around the origin by the given degrees, clockwise. */
export function rotatePoint(
  point: { x: number; y: number },
  degrees: number,
): { x: number; y: number } {
  const angle = (degrees * Math.PI) / 180
  const cos = Math.cos(angle)
  const sin = Math.sin(angle)
  return { x: point.x * cos - point.y * sin, y: point.x * sin + point.y * cos }
}

/** Seats around a placed table, in room coordinates. */
export function placedSeats(table: SeatTable): { x: number; y: number }[] {
  return seatPositions(table.shape, table.seats, table.w, table.h).map(
    (spot) => {
      const turned = rotatePoint(spot, table.rotation)
      return { x: table.x + turned.x, y: table.y + turned.y }
    },
  )
}

/**
 * A warning (never a block) when seats sit closer than SEAT_ROOM inches apart,
 * centre to centre: too many chairs for the table's size.
 */
export function crowdingWarning(table: SeatTable): string {
  if (table.seats < 2) return ''
  const spots = seatPositions(table.shape, table.seats, table.w, table.h)
  let tightest = Number.POSITIVE_INFINITY
  for (let i = 0; i < spots.length; i += 1) {
    for (let j = i + 1; j < spots.length; j += 1) {
      const a = spots[i]!
      const b = spots[j]!
      tightest = Math.min(tightest, Math.hypot(a.x - b.x, a.y - b.y))
    }
  }
  if (tightest >= SEAT_ROOM) return ''
  return `${tableLabel(table.name)} looks tight: ${table.seats} seats leave about ${Math.max(1, Math.round(tightest))}″ each. Make the table bigger or seat fewer.`
}

/** Inches shown the way the couple measures: 60″ or 152 cm, 84 ft or 25.6 m. */
export function formatLength(
  inches: number,
  unit: FloorUnit,
  scale: 'table' | 'room',
): string {
  if (unit === 'm') {
    if (scale === 'table') return `${Math.round(inches * 2.54)} cm`
    return `${(inches / INCHES_PER_METRE).toFixed(1).replace(/\.0$/, '')} m`
  }
  if (scale === 'table') return `${Math.round(inches)}″`
  return `${Math.round((inches / INCHES_PER_FOOT) * 10) / 10} ft`
}

/** A typed size in the couple's unit, back to inches. */
export function toInches(
  value: number,
  unit: FloorUnit,
  scale: 'table' | 'room',
): number {
  if (unit === 'm') {
    return scale === 'table' ? value / 2.54 : value * INCHES_PER_METRE
  }
  return scale === 'table' ? value : value * INCHES_PER_FOOT
}

/** Inches in the couple's unit, as the number their size boxes show. */
export function fromInches(
  inches: number,
  unit: FloorUnit,
  scale: 'table' | 'room',
): number {
  if (unit === 'm') {
    return scale === 'table'
      ? Math.round(inches * 2.54)
      : Math.round((inches / INCHES_PER_METRE) * 10) / 10
  }
  return scale === 'table'
    ? Math.round(inches)
    : Math.round((inches / INCHES_PER_FOOT) * 10) / 10
}

/** The grid: a light line every foot (or 50 cm), a stronger one every 5 ft (or 1 m). */
export function gridStep(unit: FloorUnit): {
  minor: number
  major: number
  snap: number
} {
  if (unit === 'm') {
    return {
      minor: INCHES_PER_METRE / 2,
      major: INCHES_PER_METRE,
      snap: INCHES_PER_METRE / 4,
    }
  }
  return { minor: 12, major: 60, snap: 6 }
}

export function snapTo(value: number, step: number): number {
  return Math.round(Math.round(value / step) * step)
}

/**
 * Where a table's number and its "6 / 8 seated" line go, relative to the
 * table's centre. Both stay upright and stacked inside the table's footprint
 * however it is turned; the count is left off when the two cannot fit
 * without touching. `minTitle` and `minCount` are the smallest sizes that
 * stay readable at the current zoom, in floor units.
 */
export function tableLabelLayout(
  table: Pick<SeatTable, 'shape' | 'w' | 'h' | 'rotation' | 'name'>,
  minTitle: number,
  minCount: number,
): {
  titleSize: number
  titleY: number
  countSize: number
  countY: number
  showCount: boolean
} {
  const turn = ((table.rotation % 180) + 180) % 180
  let innerW: number
  let innerH: number
  if (table.shape === 'round') {
    innerW = table.w * 0.7
    innerH = table.w * 0.7
  } else if (turn < 10 || turn > 170) {
    innerW = table.w
    innerH = table.h
  } else if (turn > 80 && turn < 100) {
    innerW = table.h
    innerH = table.w
  } else {
    innerW = Math.min(table.w, table.h) * 0.9
    innerH = innerW
  }
  innerW = Math.max(1, innerW - 6)
  innerH = Math.max(1, innerH - 4)
  const name = table.name.trim() || '?'
  const fitWidth = innerW / Math.max(1, name.length * 0.6)
  const titleSize =
    name.length <= 3
      ? Math.max(minTitle, Math.min(30, innerH * 0.6, fitWidth))
      : Math.max(minTitle * 0.85, Math.min(22, innerH * 0.6, fitWidth))
  const countSize = Math.max(minCount, 10)
  const gap = Math.max(2, countSize * 0.25)
  const showCount = titleSize + gap + countSize <= innerH + 2
  if (!showCount) {
    return { titleSize, titleY: 0, countSize, countY: 0, showCount }
  }
  return {
    titleSize,
    titleY: -(countSize + gap) / 2,
    countSize,
    countY: (titleSize + gap) / 2,
    showCount,
  }
}

/**
 * Where a guest's name sits beside their seat: just outside the seat along
 * the line from the table's centre, centred on that line and pulled in as
 * close as its width allows, so names stay evenly spaced and off their
 * neighbours.
 */
export function seatNameSpot(
  seat: { x: number; y: number },
  centre: { x: number; y: number },
  lines: string[],
  fontSize: number,
  seatRadius: number,
): { x: number; y: number; lineHeight: number } {
  const dx = seat.x - centre.x
  const dy = seat.y - centre.y
  const length = Math.hypot(dx, dy) || 1
  const ux = dx / length
  const uy = dy / length
  const lineHeight = fontSize * 1.15
  const longest = Math.max(1, ...lines.map((line) => line.length))
  const halfW = (longest * fontSize * 0.56) / 2
  const halfH = (Math.max(1, lines.length) * lineHeight) / 2
  const reach = seatRadius + 2 + Math.abs(ux) * halfW + Math.abs(uy) * halfH
  return {
    x: seat.x + ux * reach,
    y: seat.y + uy * reach - ((lines.length - 1) * lineHeight) / 2,
    lineHeight,
  }
}

const LABEL_LINE = 14

/**
 * A guest's name as it sits beside their seat: the full name when it fits,
 * first name and last initial when it is tight ("Elizabeth M."), and only
 * then the full name over two lines. The full name is always on hover and tap.
 */
export function seatLabelLines(name: string): string[] {
  const words = name.replace(/\s+/g, ' ').trim().split(' ').filter(Boolean)
  if (words.length === 0) return []
  const full = words.join(' ')
  if (full.length <= LABEL_LINE) return [full]
  if (words.length > 1) {
    const short = `${words[0]} ${words.at(-1)?.[0]?.toUpperCase() ?? ''}.`
    if (short.length <= LABEL_LINE) return [short]
  }
  const lines: string[] = []
  let line = ''
  for (const word of words) {
    const next = line ? `${line} ${word}` : word
    if (next.length <= LABEL_LINE || !line) {
      line = next
      continue
    }
    lines.push(line)
    line = word
  }
  if (line) lines.push(line)
  const shown = lines.slice(0, 2).map((item) =>
    item.length > LABEL_LINE ? `${item.slice(0, LABEL_LINE - 1)}…` : item,
  )
  if (lines.length > 2) {
    const last = shown[1] ?? ''
    shown[1] =
      last.length >= LABEL_LINE ? `${last.slice(0, LABEL_LINE - 1)}…` : `${last}…`
  }
  return shown
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
export function nextTableSpot(
  tables: SeatTable[],
  room: FloorRoom = defaultRoom(),
): { x: number; y: number } {
  const columns = Math.max(2, Math.floor(room.width / 200))
  const cellW = room.width / columns
  const cellH = 170
  for (let index = 0; index < MAX_TABLES; index += 1) {
    const x = Math.round(cellW * ((index % columns) + 0.5))
    const y = Math.round(150 + cellH * Math.floor(index / columns))
    const free = tables.every(
      (table) => Math.abs(table.x - x) > 60 || Math.abs(table.y - y) > 60,
    )
    if (free) return { x, y: Math.min(y, room.length - 60) }
  }
  return { x: Math.round(room.width / 2), y: Math.round(room.length / 2) }
}

/** A new table at the next free spot, sized for its seats. */
export function newTable(
  tables: SeatTable[],
  room: FloorRoom,
  id: string,
): SeatTable {
  const spot = nextTableSpot(tables, room)
  const size = tableSize('round', DEFAULT_SEATS)
  return {
    id,
    name: nextTableName(tables),
    shape: 'round',
    seats: DEFAULT_SEATS,
    x: spot.x,
    y: spot.y,
    w: size.w,
    h: size.h,
    rotation: 0,
  }
}

export function addTables(
  plan: SeatingPlan,
  count: number,
  makeId: () => string,
): SeatingPlan {
  const tables = plan.tables.slice()
  const wanted = clamp(Math.round(count), 0, MAX_TABLES - tables.length)
  for (let index = 0; index < wanted; index += 1) {
    tables.push(newTable(tables, plan.room, makeId()))
  }
  return { ...plan, tables }
}

/** A room item of this kind in the middle of the room. */
export function newRoomItem(
  kind: RoomItemKind,
  room: FloorRoom,
  id: string,
): RoomItem {
  const base = roomItemDefaults(kind)
  return {
    id,
    kind,
    label: base.label,
    x: Math.round(room.width / 2),
    y: Math.round(room.length / 2),
    w: base.w,
    h: base.h,
    rotation: 0,
  }
}

/** A new room size, keeping every table and item inside the walls. */
export function resizeRoom(
  plan: SeatingPlan,
  width: number,
  length: number,
): SeatingPlan {
  const room = {
    ...plan.room,
    width: clamp(Math.round(width), MIN_ROOM, MAX_ROOM),
    length: clamp(Math.round(length), MIN_ROOM, MAX_ROOM),
  }
  return {
    ...plan,
    room,
    tables: plan.tables.map((table) => ({
      ...table,
      x: clamp(table.x, 0, room.width),
      y: clamp(table.y, 0, room.length),
    })),
    items: plan.items.map((item) => ({
      ...item,
      x: clamp(item.x, 0, room.width),
      y: clamp(item.y, 0, room.length),
    })),
  }
}

/** Everyone's seat, alphabetical by last name: the escort-card list. */
export function findYourSeat(
  plan: SeatingPlan,
  guests: SeatableGuest[],
): { name: string; sortKey: string; table: string; seat: number }[] {
  const tables = new Map(plan.tables.map((table) => [table.id, table]))
  return guests
    .flatMap((guest) => {
      const spot = plan.seats[guest.id]
      const table = spot ? tables.get(spot.tableId) : undefined
      if (!spot || !table) return []
      const parts = guest.name.split(/\s+/)
      const last = parts.length > 1 ? (parts.at(-1) ?? '') : ''
      return [
        {
          name: guest.name,
          sortKey: `${foldName(last)} ${foldName(guest.name)}`,
          table: tableLabel(table.name),
          seat: spot.seat + 1,
        },
      ]
    })
    .sort((a, b) => a.sortKey.localeCompare(b.sortKey))
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
  if (plan.items.length > MAX_ITEMS) {
    return { ok: false, error: `Up to ${MAX_ITEMS} room items fit on one plan.` }
  }
  return {
    ok: true,
    plan: {
      room: plan.room,
      tables: plan.tables.map((table) => ({ ...table, name: table.name.trim() })),
      items: plan.items,
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

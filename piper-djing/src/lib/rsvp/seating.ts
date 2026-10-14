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
    // A 60″ round seats 8; each extra chair adds about 7″.
    const d = Math.max(60, Math.round(60 + (seats - 8) * 7))
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

/** Seat centres sit this far past the table's edge. */
const SEAT_GAP = 14

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
  const ideal =
    name.length <= 3
      ? Math.min(30, innerH * 0.6, fitWidth)
      : Math.min(22, innerH * 0.6, fitWidth)
  const countSize = Math.max(minCount, 10)
  const gap = Math.max(2, countSize * 0.2)
  // The count gets its line first; the number shrinks to make room for it,
  // but never below what reads at this zoom.
  const room = innerH - gap - countSize
  const titleFloor = Math.max(minTitle * 0.8, countSize)
  if (room >= titleFloor) {
    const titleSize = Math.max(titleFloor, Math.min(ideal, room))
    return {
      titleSize,
      titleY: -(countSize + gap) / 2,
      countSize,
      countY: (titleSize + gap) / 2,
      showCount: true,
    }
  }
  const titleSize = Math.max(minTitle, ideal)
  return { titleSize, titleY: 0, countSize, countY: 0, showCount: false }
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
  const halfW = (longest * fontSize * CHAR_WIDTH) / 2
  const halfH = (Math.max(1, lines.length) * lineHeight) / 2
  const reach = seatRadius + 2 + Math.abs(ux) * halfW + Math.abs(uy) * halfH
  return {
    x: seat.x + ux * reach,
    y: seat.y + uy * reach - ((lines.length - 1) * lineHeight) / 2,
    lineHeight,
  }
}

/**
 * Average width of a character as a share of the font size. Set generously,
 * since capitals and digits in "Mock Guest 026" run wider than lower case.
 */
const CHAR_WIDTH = 0.64
/** Clear space kept between two names. */
const LABEL_PAD = 2

export type LabelRect = { x0: number; y0: number; x1: number; y1: number }

export type SeatNameLayout = {
  lines: string[]
  x: number
  y: number
  lineHeight: number
} | null

/**
 * Names for every seat at one table, placed so no two overlap each other or
 * sit on a chair. Each name tries its full label first, then first name and
 * last initial, then the first name alone, each a little further out if
 * needed; a name that still cannot fit is left to hover and tap.
 */
export function layoutSeatNames(
  seats: { x: number; y: number }[],
  centre: { x: number; y: number },
  names: (string | null)[],
  fontSize: number,
  seatRadius: number,
  /** Floor already taken by other tables, room items and their names. */
  blocked: LabelRect[] = [],
  /** Names must stay inside these bounds (the room). */
  bounds?: LabelRect,
): SeatNameLayout[] {
  type Rect = LabelRect
  const placed: Rect[] = [
    ...blocked,
    ...seats.map((seat) => ({
      x0: seat.x - seatRadius,
      y0: seat.y - seatRadius,
      x1: seat.x + seatRadius,
      y1: seat.y + seatRadius,
    })),
  ]
  const clash = (a: Rect) =>
    placed.some(
      (b) =>
        a.x0 - LABEL_PAD < b.x1 &&
        b.x0 - LABEL_PAD < a.x1 &&
        a.y0 - LABEL_PAD < b.y1 &&
        b.y0 - LABEL_PAD < a.y1,
    )
  return names.map((name, index) => {
    const seat = seats[index]
    if (!name || !seat) return null
    const words = name.trim().split(/\s+/).filter(Boolean)
    const first = words[0] ?? name
    const last = words.at(-1) ?? ''
    // "Elizabeth M." helps; "Mock 0." from "Mock Guest 021" does not, so a
    // short form is only tried when the last name starts with a letter.
    const options = [seatLabelLines(name)]
    if (words.length > 1 && /^\p{L}/u.test(last)) {
      options.push([`${first} ${last[0]?.toUpperCase() ?? ''}.`])
    }
    for (const push of [0, fontSize * 0.9, fontSize * 1.8]) {
      for (const lines of options) {
        const spot = seatNameSpot(seat, centre, lines, fontSize, seatRadius + push)
        const longest = Math.max(1, ...lines.map((line) => line.length))
        const halfW = (longest * fontSize * CHAR_WIDTH) / 2
        const rect = {
          x0: spot.x - halfW,
          x1: spot.x + halfW,
          y0: spot.y - spot.lineHeight / 2,
          y1: spot.y + (lines.length - 0.5) * spot.lineHeight,
        }
        if (clash(rect)) continue
        if (
          bounds &&
          (rect.x0 < bounds.x0 ||
            rect.y0 < bounds.y0 ||
            rect.x1 > bounds.x1 ||
            rect.y1 > bounds.y1)
        ) {
          continue
        }
        placed.push(rect)
        return { lines, ...spot }
      }
    }
    return null
  })
}

/**
 * How a table's guests show on the chart once zoomed in: their names beside
 * the seats when every one of them fits without overlapping, otherwise seat
 * numbers on the chart and a numbered list of names beside the table.
 */
export function seatNamePlan(
  seats: { x: number; y: number }[],
  centre: { x: number; y: number },
  names: (string | null)[],
  fontSize: number,
  seatRadius: number,
):
  | { mode: 'names'; labels: SeatNameLayout[] }
  | { mode: 'numbers'; list: { seat: number; name: string }[] } {
  const labels = layoutSeatNames(seats, centre, names, fontSize, seatRadius)
  const fits = names.every((name, index) => !name || labels[index])
  if (fits) return { mode: 'names', labels }
  return {
    mode: 'numbers',
    list: names.flatMap((name, seat) => (name ? [{ seat: seat + 1, name }] : [])),
  }
}

export type TableNames =
  | { mode: 'names'; labels: SeatNameLayout[] }
  | { mode: 'numbers'; list: { seat: number; name: string }[] }

/** A name label's floor area, for collision checks. */
export function labelRect(label: NonNullable<SeatNameLayout>, fontSize: number): LabelRect {
  const longest = Math.max(1, ...label.lines.map((line) => line.length))
  const halfW = (longest * fontSize * CHAR_WIDTH) / 2
  return {
    x0: label.x - halfW,
    x1: label.x + halfW,
    y0: label.y - label.lineHeight / 2,
    y1: label.y + (label.lines.length - 0.5) * label.lineHeight,
  }
}

/** The floor a table's body and chairs cover, for name collision checks. */
function chairArea(table: SeatTable, seatRadius: number): LabelRect {
  const box = boxOf(table.x, table.y, table.w, table.h, table.rotation, 0)
  const reach = SEAT_GAP + seatRadius
  return {
    x0: box.x0 - reach,
    y0: box.y0 - reach,
    x1: box.x1 + reach,
    y1: box.y1 + reach,
  }
}

/**
 * Names for every table in the room at once. A table keeps names beside its
 * seats only when every one of its guests' names fits in full (or as
 * "Elizabeth M.") without touching another table's chairs, a room item,
 * another table's names or the room's walls. Otherwise that table shows seat
 * numbers only, with no loose names at all, and its list of names opens when
 * the table is tapped.
 */
export function planSeatNames(
  plan: SeatingPlan,
  nameOf: (guestId: string) => string | null,
  fontSize: number,
  seatRadius: number,
): Map<string, TableNames> {
  const result = new Map<string, TableNames>()
  const bounds = { x0: 0, y0: 0, x1: plan.room.width, y1: plan.room.length }
  const items: LabelRect[] = plan.items
    .filter((item) => item.kind !== 'label')
    .map((item) => boxOf(item.x, item.y, item.w, item.h, item.rotation, 0))
  const areas = new Map(
    plan.tables.map((table) => [table.id, chairArea(table, seatRadius)]),
  )
  const names: LabelRect[] = []
  for (const table of plan.tables) {
    const bySeat = new Map<number, string>()
    for (const [guestId, spot] of Object.entries(plan.seats)) {
      if (spot.tableId === table.id) bySeat.set(spot.seat, guestId)
    }
    const seated = Array.from({ length: table.seats }, (_, seat) => {
      const guestId = bySeat.get(seat)
      return guestId ? nameOf(guestId) : null
    })
    if (seated.every((name) => !name)) {
      result.set(table.id, { mode: 'names', labels: [] })
      continue
    }
    const others = plan.tables
      .filter((other) => other.id !== table.id)
      .map((other) => areas.get(other.id)!)
    const labels = layoutSeatNames(
      placedSeats(table),
      { x: table.x, y: table.y },
      seated,
      fontSize,
      seatRadius,
      [...items, ...others, ...names],
      bounds,
    )
    const fits = seated.every((name, index) => !name || labels[index])
    if (fits) {
      for (const label of labels) if (label) names.push(labelRect(label, fontSize))
      result.set(table.id, { mode: 'names', labels })
      continue
    }
    result.set(table.id, {
      mode: 'numbers',
      list: seated.flatMap((name, seat) => (name ? [{ seat: seat + 1, name }] : [])),
    })
  }
  return result
}

/**
 * Where a table's numbered name list opens: beside the table on the side
 * with the most free floor, always fully inside the room.
 */
export function nameListBox(
  plan: SeatingPlan,
  table: SeatTable,
  size: { w: number; h: number },
  seatRadius: number,
): LabelRect {
  const area = chairArea(table, seatRadius)
  const gap = 10
  const fit = (x0: number, y0: number): LabelRect => {
    const x = Math.min(Math.max(0, x0), Math.max(0, plan.room.width - size.w))
    const y = Math.min(Math.max(0, y0), Math.max(0, plan.room.length - size.h))
    return { x0: x, y0: y, x1: x + size.w, y1: y + size.h }
  }
  const candidates = [
    fit(area.x1 + gap, table.y - size.h / 2),
    fit(area.x0 - gap - size.w, table.y - size.h / 2),
    fit(table.x - size.w / 2, area.y1 + gap),
    fit(table.x - size.w / 2, area.y0 - gap - size.h),
  ]
  const others: LabelRect[] = [
    ...plan.tables.map((other) =>
      other.id === table.id ? area : chairArea(other, seatRadius),
    ),
    ...plan.items
      .filter((item) => item.kind !== 'label')
      .map((item) => boxOf(item.x, item.y, item.w, item.h, item.rotation, 0)),
  ]
  const overlap = (box: LabelRect) =>
    others.reduce((sum, other) => {
      const w = Math.min(box.x1, other.x1) - Math.max(box.x0, other.x0)
      const h = Math.min(box.y1, other.y1) - Math.max(box.y0, other.y0)
      return w > 0 && h > 0 ? sum + w * h : sum
    }, 0)
  let best = candidates[0]!
  let bestOverlap = overlap(best)
  for (const candidate of candidates.slice(1)) {
    const value = overlap(candidate)
    if (value < bestOverlap) {
      best = candidate
      bestOverlap = value
    }
  }
  return best
}

/** Grows the room 5 ft at a time until Auto-arrange fits every table. */
export function enlargeRoomToFit(
  plan: SeatingPlan,
): { plan: SeatingPlan; unplaced: number } {
  let width = plan.room.width
  let length = plan.room.length
  let last = autoArrange(plan)
  while (last.unplaced > 0 && (width < MAX_ROOM || length < MAX_ROOM)) {
    width = Math.min(MAX_ROOM, width + 60)
    length = Math.min(MAX_ROOM, length + 60)
    last = autoArrange(resizeRoom(plan, width, length))
  }
  return last
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

type Box = { x0: number; y0: number; x1: number; y1: number }

/**
 * How far chairs reach past a table's edge. Two tables' chair zones may meet,
 * which leaves their edges 4 ft apart: the walkway servers and guests use.
 */
const CHAIR_REACH = 24
/** A little air between chair zones, and between chairs and room items. */
const AISLE = 2

function boxOf(
  x: number,
  y: number,
  w: number,
  h: number,
  rotation: number,
  pad: number,
): Box {
  const angle = (rotation * Math.PI) / 180
  const bw = Math.abs(w * Math.cos(angle)) + Math.abs(h * Math.sin(angle))
  const bh = Math.abs(w * Math.sin(angle)) + Math.abs(h * Math.cos(angle))
  return {
    x0: x - bw / 2 - pad,
    y0: y - bh / 2 - pad,
    x1: x + bw / 2 + pad,
    y1: y + bh / 2 + pad,
  }
}

/** The floor a table takes up, its chairs included. */
export function tableFootprint(
  table: Pick<SeatTable, 'x' | 'y' | 'w' | 'h' | 'rotation'>,
): Box {
  return boxOf(table.x, table.y, table.w, table.h, table.rotation, CHAIR_REACH)
}

function itemFootprint(item: RoomItem): Box {
  return boxOf(item.x, item.y, item.w, item.h, item.rotation, 0)
}

function overlaps(a: Box, b: Box, gap: number): boolean {
  return (
    a.x0 < b.x1 + gap && b.x0 < a.x1 + gap && a.y0 < b.y1 + gap && b.y0 < a.y1 + gap
  )
}

function insideRoom(box: Box, room: FloorRoom): boolean {
  return box.x0 >= 0 && box.y0 >= 0 && box.x1 <= room.width && box.y1 <= room.length
}

/** Everything on the floor a new table must keep clear of. */
function obstacles(plan: SeatingPlan, ignoreTableId = ''): Box[] {
  return [
    ...plan.tables
      .filter((table) => table.id !== ignoreTableId)
      .map((table) => tableFootprint(table)),
    ...plan.items
      .filter((item) => item.kind !== 'label')
      .map((item) => itemFootprint(item)),
  ]
}

function fits(box: Box, room: FloorRoom, taken: Box[]): boolean {
  return insideRoom(box, room) && taken.every((other) => !overlaps(box, other, AISLE))
}

/**
 * The first open spot, reading the room top to bottom and left to right, where
 * a table of this size and its chairs keep clear of every other table, the
 * dance floor and every room item. Null when the room is full.
 */
export function findFreeSpot(
  plan: SeatingPlan,
  size: { w: number; h: number; rotation?: number },
  ignoreTableId = '',
): { x: number; y: number } | null {
  const taken = obstacles(plan, ignoreTableId)
  const rotation = size.rotation ?? 0
  const step = 12
  for (let y = 0; y <= plan.room.length; y += step) {
    for (let x = 0; x <= plan.room.width; x += step) {
      const box = boxOf(x, y, size.w, size.h, rotation, CHAIR_REACH)
      if (fits(box, plan.room, taken)) return { x, y }
    }
  }
  return null
}

/** An open spot on the floor for a new table, clear of everything else. */
export function nextTableSpot(
  plan: SeatingPlan,
  size: { w: number; h: number } = tableSize('round', DEFAULT_SEATS),
): { x: number; y: number } {
  return (
    findFreeSpot(plan, size) ?? {
      x: Math.round(plan.room.width / 2),
      y: Math.round(plan.room.length / 2),
    }
  )
}

/** A new round table for 8 in the first clear spot. */
export function newTable(plan: SeatingPlan, id: string): SeatTable {
  const size = tableSize('round', DEFAULT_SEATS)
  const spot = nextTableSpot(plan, size)
  return {
    id,
    name: nextTableName(plan.tables),
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
  let next = plan
  const wanted = clamp(Math.round(count), 0, MAX_TABLES - plan.tables.length)
  for (let index = 0; index < wanted; index += 1) {
    next = { ...next, tables: [...next.tables, newTable(next, makeId())] }
  }
  return next
}

function tableOrder(a: SeatTable, b: SeatTable): number {
  const aHead = a.shape === 'banquet' ? 0 : 1
  const bHead = b.shape === 'banquet' ? 0 : 1
  if (aHead !== bHead) return aHead - bHead
  const aNumber = /^\d+$/.test(a.name.trim()) ? Number(a.name) : Number.NaN
  const bNumber = /^\d+$/.test(b.name.trim()) ? Number(b.name) : Number.NaN
  if (!Number.isNaN(aNumber) && !Number.isNaN(bNumber)) return aNumber - bNumber
  if (!Number.isNaN(aNumber)) return -1
  if (!Number.isNaN(bNumber)) return 1
  return a.name.localeCompare(b.name)
}

/**
 * Lays every table out in neat rows around the dance floor (or the middle of
 * the room when there is none), nearest first: head tables, then table 1, 2…
 * No table overlaps another table, the dance floor or any room item. Tables
 * that cannot fit are counted so the couple can make the room bigger.
 */
export function autoArrange(plan: SeatingPlan): {
  plan: SeatingPlan
  unplaced: number
} {
  const floor = plan.items.find((item) => item.kind === 'dance-floor')
  const anchor = floor
    ? { x: floor.x, y: floor.y }
    : { x: plan.room.width / 2, y: plan.room.length / 2 }
  const items = plan.items
    .filter((item) => item.kind !== 'label')
    .map((item) => itemFootprint(item))
  // Every table is set square to the room when arranged.
  const upright = plan.tables.map((table) => ({ ...table, rotation: 0 }))
  const ordered = upright.slice().sort(tableOrder)
  const median = (values: number[]) => {
    const sorted = values.slice().sort((a, b) => a - b)
    return sorted[Math.floor(sorted.length / 2)] ?? 0
  }
  // The grid is sized for the typical table, so one large table cannot
  // spread every row apart; larger tables are placed first on a finer grid.
  const typical = ordered.filter((table) => table.shape !== 'banquet')
  const typicalW = median(typical.map((table) => table.w))
  const typicalH = median(typical.map((table) => table.h))
  const cellW = typicalW + CHAIR_REACH * 2 + AISLE
  const cellH = typicalH + CHAIR_REACH * 2 + AISLE
  const regular = (table: SeatTable) =>
    table.shape !== 'banquet' &&
    table.w <= typicalW * 1.1 &&
    table.h <= typicalH * 1.1
  // A grid of table spots filling the room edge to edge, tried nearest the
  // dance floor first, so tables come out in straight rows around it.
  const lattice = (stepX: number, stepY: number) => {
    const spots: { x: number; y: number; d: number }[] = []
    const cols = Math.max(1, Math.floor(plan.room.width / stepX))
    const rows = Math.max(1, Math.floor(plan.room.length / stepY))
    const startX = (plan.room.width - cols * stepX) / 2 + stepX / 2
    const startY = (plan.room.length - rows * stepY) / 2 + stepY / 2
    for (let j = 0; j < rows; j += 1) {
      for (let i = 0; i < cols; i += 1) {
        const x = Math.round(startX + i * stepX)
        const y = Math.round(startY + j * stepY)
        // Rows read better than rings: weigh up-and-down distance a little more.
        spots.push({ x, y, d: Math.hypot(x - anchor.x, (y - anchor.y) * 1.15) })
      }
    }
    return spots.sort((a, b) => a.d - b.d || a.y - b.y || a.x - b.x)
  }
  const tableSpots = cellW > 0 && cellH > 0 ? lattice(cellW, cellH) : []
  const fineSpots = lattice(12, 12)
  const placed: Box[] = []
  const moved = new Map<string, { x: number; y: number }>()
  const leftOver: SeatTable[] = []
  const first = ordered.filter((table) => !regular(table))
  const rest = ordered.filter((table) => regular(table))
  for (const table of [...first, ...rest]) {
    const taken = [...items, ...placed]
    const clear = (candidate: { x: number; y: number }) =>
      fits(tableFootprint({ ...table, ...candidate }), plan.room, taken)
    const chosen =
      (regular(table) ? tableSpots.find(clear) : undefined) ??
      fineSpots.find(clear)
    if (!chosen) {
      leftOver.push(table)
      continue
    }
    moved.set(table.id, { x: chosen.x, y: chosen.y })
    placed.push(tableFootprint({ ...table, x: chosen.x, y: chosen.y }))
  }
  // A table with no clear floor anywhere still moves: to the inside spot
  // nearest the dance floor that overlaps the least, and it is counted so the
  // couple can let the room grow.
  for (const table of leftOver) {
    const taken = [...items, ...placed]
    let best: { x: number; y: number } | null = null
    let bestOverlap = Number.POSITIVE_INFINITY
    for (const spot of fineSpots) {
      const box = tableFootprint({ ...table, x: spot.x, y: spot.y })
      if (!insideRoom(box, plan.room)) continue
      let overlap = 0
      for (const other of taken) {
        const w = Math.min(box.x1, other.x1) - Math.max(box.x0, other.x0)
        const h = Math.min(box.y1, other.y1) - Math.max(box.y0, other.y0)
        if (w > 0 && h > 0) overlap += w * h
      }
      if (overlap < bestOverlap) {
        bestOverlap = overlap
        best = { x: spot.x, y: spot.y }
        if (overlap === 0) break
      }
    }
    if (best) {
      moved.set(table.id, best)
      placed.push(tableFootprint({ ...table, ...best }))
    }
  }
  const unplaced = leftOver.length
  return {
    plan: {
      ...plan,
      tables: plan.tables.map((table) => {
        const spot = moved.get(table.id)
        return spot ? { ...table, ...spot, rotation: 0 } : table
      }),
    },
    unplaced,
  }
}

/** Tables whose chairs run into another table or a room item. */
export function overlappingTables(plan: SeatingPlan): string[] {
  const clashes = new Set<string>()
  const boxes = plan.tables.map((table) => ({
    id: table.id,
    box: tableFootprint(table),
  }))
  const items = plan.items
    .filter((item) => item.kind !== 'label')
    .map((item) => itemFootprint(item))
  for (const [index, a] of boxes.entries()) {
    for (const b of boxes.slice(index + 1)) {
      if (overlaps(a.box, b.box, 0)) {
        clashes.add(a.id)
        clashes.add(b.id)
      }
    }
    if (items.some((item) => overlaps(a.box, item, 0))) clashes.add(a.id)
  }
  return [...clashes]
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
 * Checks a plan the couple posted, and repairs rather than refuses: a seat
 * pointing at a missing table, a seat past the table's last chair or two
 * guests in one chair moves the extra guest to a free chair at that table,
 * or back to Unassigned when the table is full. A save never fails over
 * seating data. Only duplicate table numbers and plan limits are refused.
 */
export function validateSeating(
  plan: SeatingPlan,
  wedding: RsvpWedding,
):
  | { ok: true; plan: SeatingPlan; repaired: number }
  | { ok: false; error: string } {
  if (plan.tables.length > MAX_TABLES) {
    return { ok: false, error: `Up to ${MAX_TABLES} tables fit on one plan.` }
  }
  if (plan.items.length > MAX_ITEMS) {
    return { ok: false, error: `Up to ${MAX_ITEMS} room items fit on one plan.` }
  }
  const problem = tableNameProblem(plan.tables)
  if (problem) return { ok: false, error: problem }
  const tables = new Map(plan.tables.map((table) => [table.id, table]))
  const guests = new Set(seatableGuests(wedding).map((guest) => guest.id))
  const taken = new Set<string>()
  const seats: Record<string, SeatSpot> = {}
  const misplaced: { guestId: string; tableId: string }[] = []
  let repaired = 0
  for (const [guestId, spot] of Object.entries(plan.seats)) {
    const table = tables.get(spot.tableId)
    // A guest who stopped attending since the page loaded simply drops off.
    if (!guests.has(guestId)) continue
    if (!table) {
      repaired += 1
      continue
    }
    const key = `${spot.tableId}#${spot.seat}`
    if (spot.seat >= table.seats || taken.has(key)) {
      misplaced.push({ guestId, tableId: table.id })
      continue
    }
    taken.add(key)
    seats[guestId] = spot
  }
  for (const { guestId, tableId } of misplaced) {
    repaired += 1
    const table = tables.get(tableId)
    if (!table) continue
    for (let seat = 0; seat < table.seats; seat += 1) {
      const key = `${tableId}#${seat}`
      if (taken.has(key)) continue
      taken.add(key)
      seats[guestId] = { tableId, seat }
      break
    }
  }
  return {
    ok: true,
    repaired,
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

import { useRef } from 'react'
import type { DragEvent, PointerEvent as ReactPointerEvent } from 'react'
import {
  FLOOR_H,
  FLOOR_W,
  guestsAt,
  seatLabelLines,
  seatPositions,
  tableLabel,
  tableSize,
} from '../../lib/rsvp/seating.ts'
import type {
  SeatTable,
  SeatableGuest,
  SeatingPlan,
} from '../../lib/rsvp/seating.ts'

/** Screen colours follow the RSVP theme; print is always ink on white. */
const SCREEN = {
  table: 'var(--field)',
  tableLine: 'var(--border-strong)',
  seatFill: 'var(--pink)',
  seatText: '#0D0D0D',
  seatEmpty: 'var(--text-faint)',
  name: 'var(--text)',
  label: 'var(--text)',
  muted: 'var(--text-muted)',
  pick: 'var(--pink-soft)',
}

const PRINT = {
  table: '#f4f1ec',
  tableLine: '#555555',
  seatFill: '#222222',
  seatText: '#ffffff',
  seatEmpty: '#888888',
  name: '#111111',
  label: '#111111',
  muted: '#555555',
  pick: '#111111',
}

export type FloorPlanProps = {
  plan: SeatingPlan
  guests: Map<string, SeatableGuest>
  print?: boolean
  /** Guest whose seat is highlighted (tap to inspect). */
  selectedGuest?: string
  /** A guest picked from the list, waiting for a tap on a seat. */
  placing?: boolean
  onMoveTable?: (tableId: string, x: number, y: number) => void
  onMoveEnd?: () => void
  onTapSeat?: (tableId: string, seat: number, guestId: string | null) => void
  onDropGuest?: (guestId: string, tableId: string, seat?: number) => void
}

const SEAT_R = 13


function initials(guest: SeatableGuest | undefined): string {
  if (!guest) return ''
  return guest.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

/**
 * The room from above. Tables are drawn to their shape with a seat for every
 * place, the table number in the middle and "6 / 8 seated" under it. On screen
 * tables can be dragged, seats tapped, and guests dropped onto a seat or table.
 */
export function FloorPlan({
  plan,
  guests,
  print = false,
  selectedGuest = '',
  placing = false,
  onMoveTable,
  onMoveEnd,
  onTapSeat,
  onDropGuest,
}: FloorPlanProps) {
  const svg = useRef<SVGSVGElement | null>(null)
  const drag = useRef<{
    id: string
    dx: number
    dy: number
    pointer: number
  } | null>(null)
  const colours = print ? PRINT : SCREEN
  const interactive = !print

  function toFloor(clientX: number, clientY: number) {
    const element = svg.current
    const matrix = element?.getScreenCTM()
    if (!element || !matrix) return null
    const point = element.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const local = point.matrixTransform(matrix.inverse())
    return { x: local.x, y: local.y }
  }

  function startDrag(event: ReactPointerEvent, table: SeatTable) {
    if (!interactive || !onMoveTable) return
    const at = toFloor(event.clientX, event.clientY)
    if (!at) return
    event.preventDefault()
    ;(event.currentTarget as Element).setPointerCapture(event.pointerId)
    drag.current = {
      id: table.id,
      dx: at.x - table.x,
      dy: at.y - table.y,
      pointer: event.pointerId,
    }
  }

  function moveDrag(event: ReactPointerEvent) {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId || !onMoveTable) return
    const at = toFloor(event.clientX, event.clientY)
    if (!at) return
    const x = Math.round(Math.min(FLOOR_W - 30, Math.max(30, at.x - current.dx)))
    const y = Math.round(Math.min(FLOOR_H - 30, Math.max(30, at.y - current.dy)))
    onMoveTable(current.id, x, y)
  }

  function endDrag(event: ReactPointerEvent) {
    const current = drag.current
    if (!current || current.pointer !== event.pointerId) return
    drag.current = null
    onMoveEnd?.()
  }

  function dropProps(tableId: string, seat?: number) {
    if (!interactive || !onDropGuest) return {}
    return {
      onDragOver: (event: DragEvent) => {
        if (event.dataTransfer.types.includes('text/x-rsvp-guest')) {
          event.preventDefault()
          event.dataTransfer.dropEffect = 'move'
        }
      },
      onDrop: (event: DragEvent) => {
        const guestId = event.dataTransfer.getData('text/x-rsvp-guest')
        if (!guestId) return
        event.preventDefault()
        event.stopPropagation()
        onDropGuest(guestId, tableId, seat)
      },
    }
  }

  return (
    <svg
      ref={svg}
      viewBox={`0 0 ${FLOOR_W} ${FLOOR_H}`}
      className="block h-auto w-full select-none"
      role="img"
      aria-label="Seating chart floor plan"
    >
      <rect
        x={1}
        y={1}
        width={FLOOR_W - 2}
        height={FLOOR_H - 2}
        rx={18}
        fill="none"
        stroke={colours.tableLine}
        strokeDasharray="6 8"
        opacity={0.6}
      />
      {plan.tables.map((table) => {
        const size = tableSize(table.shape, table.seats)
        const spots = seatPositions(table.shape, table.seats)
        const sitting = guestsAt(plan, table.id)
        const bySeat = new Map<number, string>()
        for (const guestId of sitting) {
          const spot = plan.seats[guestId]
          if (spot) bySeat.set(spot.seat, guestId)
        }
        const label = /^\d+$/.test(table.name.trim())
          ? table.name.trim()
          : table.name.trim() || '?'
        const big = label.length <= 3
        return (
          <g key={table.id} transform={`translate(${table.x} ${table.y})`}>
            <g
              {...dropProps(table.id)}
              onPointerDown={(event) => startDrag(event, table)}
              onPointerMove={moveDrag}
              onPointerUp={endDrag}
              onPointerCancel={endDrag}
              style={{
                cursor: interactive && onMoveTable ? 'grab' : undefined,
                touchAction: interactive ? 'none' : undefined,
              }}
            >
              <title>{`${tableLabel(table.name)} · ${sitting.length} of ${table.seats} seated`}</title>
              {table.shape === 'round' ? (
                <circle
                  r={size.w / 2}
                  fill={colours.table}
                  stroke={colours.tableLine}
                  strokeWidth={2}
                />
              ) : (
                <rect
                  x={-size.w / 2}
                  y={-size.h / 2}
                  width={size.w}
                  height={size.h}
                  rx={table.shape === 'square' ? 6 : 10}
                  fill={colours.table}
                  stroke={colours.tableLine}
                  strokeWidth={2}
                />
              )}
              <text
                y={table.shape === 'banquet' ? -1 : -4}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={big ? 22 : 13}
                fontWeight={700}
                fill={colours.label}
              >
                {label.length > 16 ? `${label.slice(0, 15)}…` : label}
              </text>
              <text
                y={table.shape === 'banquet' ? 14 : big ? 17 : 13}
                textAnchor="middle"
                dominantBaseline="middle"
                fontSize={11}
                fill={colours.muted}
              >
                {sitting.length} / {table.seats} seated
              </text>
            </g>
            {spots.map((spot, seat) => {
              const guestId = bySeat.get(seat) ?? null
              const guest = guestId ? guests.get(guestId) : undefined
              const chosen = guestId !== null && guestId === selectedGuest
              const length = Math.hypot(spot.x, spot.y) || 1
              const out = { x: spot.x / length, y: spot.y / length }
              const nameX = spot.x + out.x * (SEAT_R + 6)
              const nameY = spot.y + out.y * (SEAT_R + 6)
              const anchor =
                Math.abs(out.x) < 0.35 ? 'middle' : out.x > 0 ? 'start' : 'end'
              return (
                <g
                  key={seat}
                  {...dropProps(table.id, seat)}
                  onClick={
                    interactive && onTapSeat
                      ? () => onTapSeat(table.id, seat, guestId)
                      : undefined
                  }
                  style={{
                    cursor: interactive && onTapSeat ? 'pointer' : undefined,
                  }}
                >
                  <title>
                    {guest
                      ? `${guest.name}${guest.meal ? ` · ${guest.meal}` : ''} · seat ${seat + 1}`
                      : `Empty seat ${seat + 1}`}
                  </title>
                  <circle
                    cx={spot.x}
                    cy={spot.y}
                    r={SEAT_R}
                    fill={guest ? colours.seatFill : 'transparent'}
                    stroke={
                      chosen
                        ? colours.pick
                        : guest
                          ? colours.seatFill
                          : colours.seatEmpty
                    }
                    strokeWidth={chosen ? 4 : 1.5}
                    strokeDasharray={guest || !placing ? undefined : '3 3'}
                  />
                  {guest ? (
                    <>
                      <text
                        x={spot.x}
                        y={spot.y + 0.5}
                        textAnchor="middle"
                        dominantBaseline="middle"
                        fontSize={10}
                        fontWeight={700}
                        fill={colours.seatText}
                      >
                        {initials(guest)}
                      </text>
                      <SeatName
                        lines={seatLabelLines(guest.name)}
                        x={nameX}
                        y={nameY}
                        anchor={anchor}
                        above={out.y < -0.35}
                        side={Math.abs(out.y) <= 0.35}
                        fill={colours.name}
                      />
                    </>
                  ) : null}
                </g>
              )
            })}
          </g>
        )
      })}
    </svg>
  )
}

const LINE_HEIGHT = 11

/** The name beside a seat, one or two lines, stacked away from the table. */
function SeatName({
  lines,
  x,
  y,
  anchor,
  above,
  side,
  fill,
}: {
  lines: string[]
  x: number
  y: number
  anchor: 'start' | 'middle' | 'end'
  above: boolean
  side: boolean
  fill: string
}) {
  const spread = (lines.length - 1) * LINE_HEIGHT
  const top = above ? y - spread : side ? y - spread / 2 : y
  return (
    <text
      textAnchor={anchor}
      dominantBaseline="middle"
      fontSize={lines.length > 1 ? 10 : 11}
      fill={fill}
    >
      {lines.map((line, index) => (
        <tspan key={index} x={x} y={top + index * LINE_HEIGHT}>
          {line}
        </tspan>
      ))}
    </text>
  )
}

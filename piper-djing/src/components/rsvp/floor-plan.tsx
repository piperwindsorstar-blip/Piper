import { useEffect, useId, useMemo, useRef, useState } from 'react'
import type {
  DragEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import {
  contentBox,
  MIN_SIZE,
  fitTableSize,
  gridStep,
  guestsAt,
  normalAngle,
  placedSeats,
  nameListBox,
  planSeatNames,
  rotatePoint,
  snapTo,
  tableLabel,
  tableLabelLayout,
} from '../../lib/rsvp/seating.ts'
import type {
  RoomItem,
  RoomItemKind,
  SeatTable,
  SeatableGuest,
  SeatingPlan,
  TableNames,
} from '../../lib/rsvp/seating.ts'

/** Screen colours follow the RSVP theme; print is always ink on white. */
const SCREEN = {
  room: 'var(--surface)',
  wall: 'var(--border-strong)',
  gridMinor: 'var(--border)',
  gridMajor: 'var(--border-strong)',
  table: 'var(--field)',
  tableLine: 'var(--text-muted)',
  seatFill: 'var(--pink)',
  seatText: '#0D0D0D',
  seatEmpty: 'var(--text-faint)',
  name: 'var(--text)',
  label: 'var(--text)',
  muted: 'var(--text-muted)',
  pick: 'var(--pink-soft)',
  item: 'var(--pink-tint)',
  itemLine: 'var(--pink)',
  itemText: 'var(--text)',
  handle: 'var(--pink)',
}

const PRINT = {
  room: '#ffffff',
  wall: '#111111',
  gridMinor: '#eeeeee',
  gridMajor: '#dddddd',
  table: '#ffffff',
  tableLine: '#111111',
  seatFill: '#ffffff',
  seatText: '#111111',
  seatEmpty: '#999999',
  name: '#111111',
  label: '#000000',
  muted: '#444444',
  pick: '#111111',
  item: '#f2f2f2',
  itemLine: '#555555',
  itemText: '#111111',
  handle: '#111111',
}

export type Selection = { kind: 'table' | 'item'; id: string } | null

export type FloorPlanProps = {
  plan: SeatingPlan
  guests: Map<string, SeatableGuest>
  /** The couple's venue layout, faded behind the plan. */
  image?: string
  print?: boolean
  selection?: Selection
  onSelect?: (selection: Selection) => void
  /** Guest whose seat is highlighted (tap to inspect). */
  selectedGuest?: string
  /** A guest picked from the list, waiting for a tap on a seat. */
  placing?: boolean
  /** Every step of a drag, resize or turn, for the screen only. */
  onChange?: (plan: SeatingPlan) => void
  /** The drag, resize or turn is finished: save it. */
  onCommit?: (plan: SeatingPlan) => void
  onTapSeat?: (tableId: string, seat: number, guestId: string | null) => void
  onDropGuest?: (guestId: string, tableId: string, seat?: number) => void
  /** Change it to zoom back to the tables, e.g. after adding or arranging. */
  fitKey?: number
}

type View = { x: number; y: number; w: number; h: number }

type Gesture =
  | { type: 'none' }
  | {
      type: 'move'
      kind: 'table' | 'item'
      id: string
      dx: number
      dy: number
      startX: number
      startY: number
      moved: boolean
    }
  | {
      type: 'resize'
      kind: 'table' | 'item'
      id: string
      startX: number
      startY: number
      moved: boolean
    }
  | {
      type: 'rotate'
      kind: 'table' | 'item'
      id: string
      startX: number
      startY: number
      moved: boolean
    }
  | {
      type: 'pan'
      view: View
      startX: number
      startY: number
      moved: boolean
      background: boolean
    }
  | {
      type: 'pinch'
      view: View
      distance: number
      mid: { x: number; y: number }
    }
  | {
      type: 'seat'
      tableId: string
      seat: number
      guestId: string | null
      startX: number
      startY: number
      moved: boolean
    }

const SEAT_R = 10
const NAME_SIZE = 9

function fitView(plan: SeatingPlan): View {
  const pad = Math.max(36, Math.min(plan.room.width, plan.room.length) * 0.05)
  return {
    x: -pad,
    y: -pad,
    w: plan.room.width + pad * 2,
    h: plan.room.length + pad * 2,
  }
}

/** Smallest view when zoomed to the tables: about 20 by 14 ft. */
const MIN_FIT_W = 240
const MIN_FIT_H = 170

/**
 * Frames what is in the room (tables, chairs and room items) so tables are
 * big enough to read. An empty room shows whole.
 */
function fitContent(plan: SeatingPlan): View {
  const box = contentBox(plan)
  if (!box) return fitView(plan)
  const pad = 30
  let w = Math.max(MIN_FIT_W, box.x1 - box.x0 + pad * 2)
  let h = Math.max(MIN_FIT_H, box.y1 - box.y0 + pad * 2)
  const room = fitView(plan)
  // Never zoomed out further than the whole room.
  w = Math.min(w, room.w)
  h = Math.min(h, room.h)
  const cx = (box.x0 + box.x1) / 2
  const cy = (box.y0 + box.y1) / 2
  return { x: cx - w / 2, y: cy - h / 2, w, h }
}

function initials(guest: SeatableGuest | undefined): string {
  if (!guest) return ''
  return guest.name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('')
}

function hitOf(target: EventTarget | null): HTMLElement | SVGElement | null {
  if (!(target instanceof Element)) return null
  return target.closest('[data-hit]') as HTMLElement | SVGElement | null
}

/**
 * The room from above, to scale. Tables and room items can be dragged,
 * resized from their corners and turned from the handle above them; the grid
 * snaps when snapping is on. One finger or the mouse on empty floor pans, two
 * fingers pinch to zoom, and the buttons zoom or fit the room to the screen.
 */
export function FloorPlan({
  plan,
  guests,
  image = '',
  print = false,
  selection = null,
  onSelect,
  selectedGuest = '',
  placing = false,
  onChange,
  onCommit,
  onTapSeat,
  onDropGuest,
  fitKey = 0,
}: FloorPlanProps) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const svg = useRef<SVGSVGElement | null>(null)
  const colours = print ? PRINT : SCREEN
  const editable = !print && Boolean(onChange)
  const [view, setView] = useState<View>(() =>
    print ? fitView(plan) : fitContent(plan),
  )
  const viewRef = useRef(view)
  viewRef.current = view
  const planRef = useRef(plan)
  planRef.current = plan
  const gesture = useRef<Gesture>({ type: 'none' })
  const pointers = useRef(new Map<number, { x: number; y: number }>())
  const roomKey = `${plan.room.width}x${plan.room.length}`
  const step = gridStep(plan.room.unit)

  // The page asks for a fresh fit after it adds or arranges tables.
  const lastFit = useRef(fitKey)
  useEffect(() => {
    if (lastFit.current === fitKey) return
    lastFit.current = fitKey
    const next = fitContent(planRef.current)
    viewRef.current = next
    setView(next)
  }, [fitKey])

  // A new room size refits the view so the whole room shows.
  const lastRoom = useRef(roomKey)
  useEffect(() => {
    if (lastRoom.current === roomKey) return
    lastRoom.current = roomKey
    setView(fitView(planRef.current))
  }, [roomKey])

  // The mouse wheel and a trackpad pinch zoom around the pointer; a
  // two-finger trackpad swipe pans.
  useEffect(() => {
    const element = svg.current
    if (!element || print) return
    const wheel = (event: WheelEvent) => {
      event.preventDefault()
      const pixels =
        event.deltaMode === 1
          ? 16
          : event.deltaMode === 2
            ? element.clientHeight
            : 1
      const dx = event.deltaX * pixels
      const dy = event.deltaY * pixels
      const pinch = event.ctrlKey || event.metaKey
      // A trackpad swipe moves sideways too; a mouse wheel only goes up and down.
      const swipe = !pinch && event.deltaMode === 0 && Math.abs(dx) > 0.5
      if (swipe) {
        const rect = element.getBoundingClientRect()
        const current = viewRef.current
        const per = Math.max(current.w / rect.width, current.h / rect.height)
        const next = {
          ...current,
          x: current.x + dx * per,
          y: current.y + dy * per,
        }
        viewRef.current = next
        setView(next)
        return
      }
      const at = toRoom(event.clientX, event.clientY)
      if (!at) return
      const strength = pinch ? 0.01 : 0.0015
      zoomAt(at, Math.exp(-Math.max(-400, Math.min(400, dy)) * strength))
    }
    element.addEventListener('wheel', wheel, { passive: false })
    return () => element.removeEventListener('wheel', wheel)
  })

  // How many floor units one screen pixel covers, so labels never shrink
  // below a readable size however far the couple zooms out.
  const [box, setBox] = useState({ w: 0, h: 0 })
  useEffect(() => {
    const element = svg.current
    if (!element || print || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => {
      if (!entry) return
      setBox({ w: entry.contentRect.width, h: entry.contentRect.height })
    })
    observer.observe(element)
    return () => observer.disconnect()
  }, [print])

  function toRoom(clientX: number, clientY: number) {
    const element = svg.current
    const matrix = element?.getScreenCTM()
    if (!element || !matrix) return null
    const point = element.createSVGPoint()
    point.x = clientX
    point.y = clientY
    const local = point.matrixTransform(matrix.inverse())
    return { x: local.x, y: local.y }
  }

  function zoomAt(at: { x: number; y: number }, factor: number) {
    const current = viewRef.current
    const room = planRef.current.room
    const maxW = Math.max(room.width, room.length) * 3
    const w = Math.min(maxW, Math.max(96, current.w / factor))
    const scale = w / current.w
    const h = current.h * scale
    const next = {
      x: at.x - (at.x - current.x) * scale,
      y: at.y - (at.y - current.y) * scale,
      w,
      h,
    }
    viewRef.current = next
    setView(next)
  }

  function zoomCentre(factor: number) {
    const current = viewRef.current
    zoomAt({ x: current.x + current.w / 2, y: current.y + current.h / 2 }, factor)
  }

  function snap(value: number) {
    return planRef.current.room.snap ? snapTo(value, step.snap) : Math.round(value)
  }

  function findThing(kind: 'table' | 'item', id: string) {
    const current = planRef.current
    return kind === 'table'
      ? current.tables.find((table) => table.id === id)
      : current.items.find((item) => item.id === id)
  }

  function update(
    kind: 'table' | 'item',
    id: string,
    change: Partial<SeatTable> & Partial<RoomItem>,
  ) {
    const current = planRef.current
    const next: SeatingPlan =
      kind === 'table'
        ? {
            ...current,
            tables: current.tables.map((table) =>
              table.id === id ? { ...table, ...change } : table,
            ),
          }
        : {
            ...current,
            items: current.items.map((item) =>
              item.id === id ? { ...item, ...change } : item,
            ),
          }
    planRef.current = next
    onChange?.(next)
  }

  function startPinch() {
    const points = [...pointers.current.values()]
    if (points.length < 2) return
    const [a, b] = points as [{ x: number; y: number }, { x: number; y: number }]
    gesture.current = {
      type: 'pinch',
      view: viewRef.current,
      distance: Math.hypot(a.x - b.x, a.y - b.y) || 1,
      mid: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
    }
  }

  function onPointerDown(event: ReactPointerEvent<SVGSVGElement>) {
    if (print) return
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    svg.current?.setPointerCapture(event.pointerId)
    if (pointers.current.size >= 2) {
      // Two fingers: whatever was being dragged stays where it got to.
      finishEdit()
      startPinch()
      return
    }
    const hit = hitOf(event.target)
    const kind = hit?.getAttribute('data-hit') ?? 'background'
    const id = hit?.getAttribute('data-id') ?? ''
    const at = toRoom(event.clientX, event.clientY)
    if (!at) return
    const base = { startX: event.clientX, startY: event.clientY, moved: false }
    if (kind === 'seat' && hit) {
      gesture.current = {
        type: 'seat',
        tableId: id,
        seat: Number(hit.getAttribute('data-seat') ?? '0'),
        guestId: hit.getAttribute('data-guest') || null,
        ...base,
      }
      return
    }
    if (editable && (kind === 'table' || kind === 'item')) {
      const thing = findThing(kind, id)
      if (!thing) return
      onSelect?.({ kind, id })
      gesture.current = {
        type: 'move',
        kind,
        id,
        dx: at.x - thing.x,
        dy: at.y - thing.y,
        ...base,
      }
      event.preventDefault()
      return
    }
    if (editable && (kind === 'resize' || kind === 'rotate')) {
      const owner = hit?.getAttribute('data-kind') === 'item' ? 'item' : 'table'
      gesture.current = { type: kind, kind: owner, id, ...base }
      event.preventDefault()
      return
    }
    gesture.current = {
      type: 'pan',
      view: viewRef.current,
      background: true,
      ...base,
    }
  }

  function onPointerMove(event: ReactPointerEvent<SVGSVGElement>) {
    if (!pointers.current.has(event.pointerId)) return
    pointers.current.set(event.pointerId, {
      x: event.clientX,
      y: event.clientY,
    })
    const current = gesture.current
    if (current.type === 'pinch') {
      const points = [...pointers.current.values()]
      if (points.length < 2) return
      const [a, b] = points as [
        { x: number; y: number },
        { x: number; y: number },
      ]
      const distance = Math.hypot(a.x - b.x, a.y - b.y) || 1
      const factor = distance / current.distance
      const element = svg.current
      const rect = element?.getBoundingClientRect()
      if (!rect) return
      const per = current.view.w / rect.width
      const mid = { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 }
      const room = planRef.current.room
      const maxW = Math.max(room.width, room.length) * 3
      const w = Math.min(maxW, Math.max(96, current.view.w / factor))
      const scale = w / current.view.w
      // Keep the floor under the fingers' midpoint where it was.
      const anchorX = current.view.x + (current.mid.x - rect.left) * per
      const anchorY = current.view.y + (current.mid.y - rect.top) * per
      const next = {
        x: anchorX - (mid.x - rect.left) * per * scale,
        y: anchorY - (mid.y - rect.top) * per * scale,
        w,
        h: current.view.h * scale,
      }
      viewRef.current = next
      setView(next)
      return
    }
    if (current.type === 'none') return
    const travelled = Math.hypot(
      event.clientX - current.startX,
      event.clientY - current.startY,
    )
    if (!current.moved && travelled < 4) return
    current.moved = true
    if (current.type === 'pan') {
      const rect = svg.current?.getBoundingClientRect()
      if (!rect) return
      const per = current.view.w / rect.width
      const next = {
        ...current.view,
        x: current.view.x - (event.clientX - current.startX) * per,
        y: current.view.y - (event.clientY - current.startY) * per,
      }
      viewRef.current = next
      setView(next)
      return
    }
    if (current.type === 'seat') return
    const at = toRoom(event.clientX, event.clientY)
    if (!at) return
    const thing = findThing(current.kind, current.id)
    if (!thing) return
    const room = planRef.current.room
    if (current.type === 'move') {
      update(current.kind, current.id, {
        x: Math.min(room.width, Math.max(0, snap(at.x - current.dx))),
        y: Math.min(room.length, Math.max(0, snap(at.y - current.dy))),
      })
      return
    }
    if (current.type === 'rotate') {
      let angle =
        (Math.atan2(at.y - thing.y, at.x - thing.x) * 180) / Math.PI + 90
      if (event.shiftKey) angle = Math.round(angle / 15) * 15
      update(current.kind, current.id, { rotation: normalAngle(angle) })
      return
    }
    // Resize from a corner: the table grows evenly around its centre.
    const local = rotatePoint(
      { x: at.x - thing.x, y: at.y - thing.y },
      -thing.rotation,
    )
    const w = Math.max(MIN_SIZE, snap(Math.abs(local.x) * 2))
    const h = Math.max(MIN_SIZE / 2, snap(Math.abs(local.y) * 2))
    if (current.kind === 'table') {
      const table = thing as SeatTable
      const even = table.shape === 'round' || table.shape === 'square'
      const size = fitTableSize(table.shape, even ? Math.max(w, h) : w, h)
      update('table', current.id, size)
    } else {
      update('item', current.id, { w, h })
    }
  }

  function finishEdit() {
    const current = gesture.current
    if (
      (current.type === 'move' ||
        current.type === 'resize' ||
        current.type === 'rotate') &&
      current.moved
    ) {
      onCommit?.(planRef.current)
    }
    gesture.current = { type: 'none' }
  }

  function onPointerUp(event: ReactPointerEvent<SVGSVGElement>) {
    pointers.current.delete(event.pointerId)
    const current = gesture.current
    if (current.type === 'pinch') {
      if (pointers.current.size < 2) gesture.current = { type: 'none' }
      return
    }
    if (current.type === 'seat' && !current.moved) {
      onTapSeat?.(current.tableId, current.seat, current.guestId)
    }
    if (current.type === 'pan' && !current.moved && current.background) {
      onSelect?.(null)
    }
    finishEdit()
  }

  function onDragOver(event: DragEvent<SVGSVGElement>) {
    if (!onDropGuest) return
    if (event.dataTransfer.types.includes('text/x-rsvp-guest')) {
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
    }
  }

  function onDrop(event: DragEvent<SVGSVGElement>) {
    if (!onDropGuest) return
    const guestId = event.dataTransfer.getData('text/x-rsvp-guest')
    if (!guestId) return
    const hit = hitOf(event.target)
    const kind = hit?.getAttribute('data-hit')
    const id = hit?.getAttribute('data-id') ?? ''
    if (kind === 'seat') {
      event.preventDefault()
      onDropGuest(guestId, id, Number(hit?.getAttribute('data-seat') ?? '0'))
      return
    }
    if (kind === 'table') {
      event.preventDefault()
      onDropGuest(guestId, id)
    }
  }

  const shown = print ? fitView(plan) : view
  const perPixel =
    print || box.w === 0 || box.h === 0
      ? 0
      : Math.max(shown.w / box.w, shown.h / box.h)
  const [hovered, setHovered] = useState('')
  const namesShown = !print && perPixel > 0 && NAME_SIZE / perPixel >= 8
  // Names for the whole room are planned together, so no table's names land
  // on another table, a room item, another table's names or a wall.
  const namePlans = useMemo(
    () =>
      namesShown
        ? planSeatNames(
            plan,
            (guestId) => guests.get(guestId)?.name ?? null,
            NAME_SIZE,
            SEAT_R,
          )
        : null,
    [namesShown, plan, guests],
  )
  const handleR = print ? 0 : Math.max(6, view.w / 90)
  const selectedTable =
    selection?.kind === 'table'
      ? plan.tables.find((table) => table.id === selection.id)
      : undefined
  const selectedItem =
    selection?.kind === 'item'
      ? plan.items.find((item) => item.id === selection.id)
      : undefined

  const gridLines = useMemo(
    () => ({ minor: step.minor, major: step.major }),
    [step.minor, step.major],
  )

  return (
    <div className="relative">
      <svg
        ref={svg}
        viewBox={`${shown.x} ${shown.y} ${shown.w} ${shown.h}`}
        preserveAspectRatio="xMidYMid meet"
        className={
          print
            ? 'block h-auto w-full'
            : 'block h-[min(62vh,520px)] w-full select-none rounded-3xl sm:h-[min(70vh,640px)]'
        }
        style={print ? undefined : { touchAction: 'none' }}
        role="img"
        aria-label="Seating chart floor plan"
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDragOver={onDragOver}
        onDrop={onDrop}
      >
        <defs>
          <pattern
            id={`minor-${uid}`}
            width={gridLines.minor}
            height={gridLines.minor}
            patternUnits="userSpaceOnUse"
          >
            <path
              d={`M ${gridLines.minor} 0 L 0 0 0 ${gridLines.minor}`}
              fill="none"
              stroke={colours.gridMinor}
              strokeWidth={0.6}
            />
          </pattern>
          <pattern
            id={`major-${uid}`}
            width={gridLines.major}
            height={gridLines.major}
            patternUnits="userSpaceOnUse"
          >
            <rect
              width={gridLines.major}
              height={gridLines.major}
              fill={`url(#minor-${uid})`}
            />
            <path
              d={`M ${gridLines.major} 0 L 0 0 0 ${gridLines.major}`}
              fill="none"
              stroke={colours.gridMajor}
              strokeWidth={1.2}
            />
          </pattern>
        </defs>
        <rect
          data-hit="background"
          x={0}
          y={0}
          width={plan.room.width}
          height={plan.room.length}
          fill={colours.room}
        />
        {image && !print ? (
          <image
            href={image}
            x={0}
            y={0}
            width={plan.room.width}
            height={plan.room.length}
            preserveAspectRatio="xMidYMid meet"
            opacity={0.35}
            pointerEvents="none"
          />
        ) : null}
        <rect
          x={0}
          y={0}
          width={plan.room.width}
          height={plan.room.length}
          fill={`url(#major-${uid})`}
          opacity={print ? 0.5 : 0.8}
          pointerEvents="none"
        />
        <rect
          x={0}
          y={0}
          width={plan.room.width}
          height={plan.room.length}
          fill="none"
          stroke={colours.wall}
          strokeWidth={print ? 3 : 4}
          pointerEvents="none"
        />

        {plan.items.map((item) => (
          <ItemShape
            key={item.id}
            item={item}
            colours={colours}
            print={print}
          />
        ))}

        {plan.tables.map((table) => (
          <TableShape
            key={table.id}
            table={table}
            plan={plan}
            guests={guests}
            colours={colours}
            print={print}
            selectedGuest={selectedGuest}
            placing={placing}
            interactive={!print}
            perPixel={perPixel}
            names={namePlans?.get(table.id) ?? null}
            onHover={setHovered}
            active={
              (selection?.kind === 'table' && selection.id === table.id) ||
              hovered === table.id
            }
          />
        ))}
        {plan.tables.map((table) => (
          <TableShape
            key={`list-${table.id}`}
            layer="callout"
            table={table}
            plan={plan}
            guests={guests}
            colours={colours}
            print={print}
            selectedGuest={selectedGuest}
            placing={placing}
            interactive={!print}
            perPixel={perPixel}
            names={namePlans?.get(table.id) ?? null}
            onHover={setHovered}
            active={
              (selection?.kind === 'table' && selection.id === table.id) ||
              hovered === table.id
            }
          />
        ))}

        {editable && selectedTable ? (
          <Handles
            kind="table"
            thing={selectedTable}
            r={handleR}
            colour={colours.handle}
          />
        ) : null}
        {editable && selectedItem ? (
          <Handles
            kind="item"
            thing={selectedItem}
            r={handleR}
            colour={colours.handle}
          />
        ) : null}
      </svg>
      {print ? null : (
        <div className="absolute right-3 top-3 flex flex-col gap-2">
          <ZoomButton label="Zoom in" onClick={() => zoomCentre(1.25)}>
            +
          </ZoomButton>
          <ZoomButton label="Zoom out" onClick={() => zoomCentre(0.8)}>
            −
          </ZoomButton>
          <ZoomButton
            label="Zoom to the tables"
            wide
            onClick={() => {
              const next = fitContent(planRef.current)
              viewRef.current = next
              setView(next)
            }}
          >
            Fit
          </ZoomButton>
          <ZoomButton
            label="Show the whole room"
            wide
            onClick={() => {
              const next = fitView(planRef.current)
              viewRef.current = next
              setView(next)
            }}
          >
            Room
          </ZoomButton>
        </div>
      )}
    </div>
  )
}

function ZoomButton({
  label,
  onClick,
  wide = false,
  children,
}: {
  label: string
  onClick: () => void
  wide?: boolean
  children: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      className={`grid h-11 ${wide ? 'px-3' : 'w-11'} place-items-center rounded-full border border-[var(--border-strong)] bg-[var(--surface)] text-base font-semibold text-[var(--text)] shadow-sm`}
      onClick={onClick}
    >
      {children}
    </button>
  )
}

type Colours = typeof SCREEN

const ITEM_STYLE: Record<RoomItemKind, { dash?: string; fill?: boolean }> = {
  'dance-floor': { fill: true },
  'dj-booth': { fill: true },
  'head-table': { fill: true },
  cake: { fill: true },
  gift: { fill: true },
  bar: { fill: true },
  buffet: { fill: true },
  photo: { dash: '10 8', fill: true },
  door: { fill: true },
  label: {},
}

function ItemShape({
  item,
  colours,
  print,
}: {
  item: RoomItem
  colours: Colours
  print: boolean
}) {
  const style = ITEM_STYLE[item.kind]
  const isLabel = item.kind === 'label'
  const fontSize = Math.max(
    10,
    Math.min(isLabel ? item.h * 0.75 : 26, item.h * 0.45, (item.w / Math.max(4, item.label.length)) * 1.6),
  )
  return (
    <g
      transform={`translate(${item.x} ${item.y}) rotate(${item.rotation})`}
      data-hit="item"
      data-id={item.id}
      style={{ cursor: print ? undefined : 'move' }}
    >
      <title>{item.label || 'Label'}</title>
      <rect
        x={-item.w / 2}
        y={-item.h / 2}
        width={item.w}
        height={item.h}
        rx={item.kind === 'dance-floor' ? 4 : 8}
        fill={isLabel ? 'transparent' : style.fill ? colours.item : 'none'}
        stroke={isLabel ? 'transparent' : colours.itemLine}
        strokeWidth={2}
        strokeDasharray={style.dash}
      />
      {item.kind === 'dance-floor' ? (
        <path
          d={checker(item.w, item.h)}
          fill={colours.itemLine}
          opacity={0.12}
          pointerEvents="none"
        />
      ) : null}
      <text
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize={fontSize}
        fontWeight={700}
        fill={colours.itemText}
        pointerEvents="none"
      >
        {item.label || (isLabel ? 'Label' : '')}
      </text>
    </g>
  )
}

/** A light checkerboard so the dance floor reads as one at a glance. */
function checker(w: number, h: number): string {
  const cell = Math.max(12, Math.min(w, h) / 8)
  const parts: string[] = []
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      if ((Math.floor(x / cell) + Math.floor(y / cell)) % 2 === 1) continue
      const cw = Math.min(cell, w - x)
      const ch = Math.min(cell, h - y)
      parts.push(`M${x - w / 2} ${y - h / 2}h${cw}v${ch}h${-cw}z`)
    }
  }
  return parts.join('')
}

function TableShape({
  table,
  plan,
  guests,
  colours,
  print,
  selectedGuest,
  placing,
  interactive,
  perPixel,
  layer = 'table',
  names = null,
  active = false,
  onHover,
}: {
  table: SeatTable
  plan: SeatingPlan
  guests: Map<string, SeatableGuest>
  colours: Colours
  print: boolean
  selectedGuest: string
  placing: boolean
  interactive: boolean
  /** Floor units per screen pixel; 0 in print. */
  perPixel: number
  /** Name lists draw in a second pass, above every table. */
  layer?: 'table' | 'callout'
  /** This table's names, planned with the whole room; null hides names. */
  names?: TableNames | null
  /** Tapped or hovered: open the name list. */
  active?: boolean
  onHover?: (tableId: string) => void
}) {
  const sitting = guestsAt(plan, table.id)
  const bySeat = new Map<number, string>()
  for (const guestId of sitting) {
    const spot = plan.seats[guestId]
    if (spot) bySeat.set(spot.seat, guestId)
  }
  const label = table.name.trim() || '?'
  const spots = placedSeats(table)
  // At least 14 px for the number and 11 px for the count on screen.
  const layout = tableLabelLayout(
    table,
    print ? 14 : Math.max(10, perPixel * 12),
    print ? 0 : Math.max(9, perPixel * 9),
  )
  // Names only once they are big enough to read without running together;
  // at Fit zoom and in print the plan shows table numbers and counts only.
  const showNames = names !== null
  const labels = names?.mode === 'names' ? names.labels : []
  const numbered = names?.mode === 'numbers'
  // A table whose names cannot all fit shows seat numbers only; its list of
  // names opens beside it while the table is tapped or hovered.
  const callout =
    names?.mode === 'numbers' && active && names.list.length > 0
      ? (() => {
          const lineHeight = NAME_SIZE * 1.3
          const rows = [
            tableLabel(table.name),
            ...names.list.map((row) => `${row.seat}. ${row.name}`),
          ]
          const width =
            Math.max(...rows.map((row) => row.length)) * NAME_SIZE * 0.64 + 14
          const height = rows.length * lineHeight + 10
          const box = nameListBox(plan, table, { w: width, h: height }, SEAT_R)
          return { rows, lineHeight, width, height, x: box.x0, y: box.y0 }
        })()
      : null
  if (layer === 'callout') {
    if (!callout) return null
  }
  return (
    <g>
      {layer === 'callout' ? null : (<>
      <g
        transform={`translate(${table.x} ${table.y}) rotate(${table.rotation})`}
        data-hit="table"
        data-id={table.id}
        style={{ cursor: interactive ? 'move' : undefined }}
        onPointerEnter={(event) => {
          if (event.pointerType === 'mouse') onHover?.(table.id)
        }}
        onPointerLeave={(event) => {
          if (event.pointerType === 'mouse') onHover?.('')
        }}
      >
        <title>{`${tableLabel(table.name)} · ${sitting.length} of ${table.seats} seated`}</title>
        {table.shape === 'round' ? (
          <circle
            r={table.w / 2}
            fill={colours.table}
            stroke={colours.tableLine}
            strokeWidth={print ? 2.5 : 2}
          />
        ) : (
          <rect
            x={-table.w / 2}
            y={-table.h / 2}
            width={table.w}
            height={table.h}
            rx={table.shape === 'square' ? 4 : 6}
            fill={colours.table}
            stroke={colours.tableLine}
            strokeWidth={print ? 2.5 : 2}
          />
        )}
      </g>
      {/* Number and count stay upright, stacked, however the table turns. */}
      <text
        x={table.x}
        y={table.y + layout.titleY}
        textAnchor="middle"
        dominantBaseline="central"
        fontSize={layout.titleSize}
        fontWeight={800}
        fill={colours.label}
        stroke={print ? undefined : colours.table}
        strokeWidth={print ? undefined : layout.titleSize * 0.18}
        paintOrder="stroke"
        pointerEvents="none"
      >
        {label.length > 16 ? `${label.slice(0, 15)}…` : label}
      </text>
      {layout.showCount ? (
        <text
          x={table.x}
          y={table.y + layout.countY}
          textAnchor="middle"
          dominantBaseline="central"
          fontSize={layout.countSize}
          fontWeight={600}
          fill={colours.muted}
          pointerEvents="none"
        >
          {sitting.length} / {table.seats}
        </text>
      ) : null}
      {spots.map((spot, seat) => {
        const guestId = bySeat.get(seat) ?? null
        const guest = guestId ? guests.get(guestId) : undefined
        const chosen = guestId !== null && guestId === selectedGuest
        const name = labels[seat] ?? null
        return (
          <g
            key={seat}
            data-hit="seat"
            data-id={table.id}
            data-seat={seat}
            data-guest={guestId ?? ''}
            style={{ cursor: interactive ? 'pointer' : undefined }}
          >
            <title>
              {guest
                ? `${guest.name}${guest.meal ? ` · ${guest.meal}` : ''} · ${tableLabel(table.name)}, seat ${seat + 1}`
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
                    ? print
                      ? colours.tableLine
                      : colours.seatFill
                    : colours.seatEmpty
              }
              strokeWidth={chosen ? 4 : 1.5}
              strokeDasharray={guest || !placing ? undefined : '3 3'}
            />
            {guest && showNames && (name || numbered) ? (
              <>
                <text
                  x={spot.x}
                  y={spot.y + 0.5}
                  textAnchor="middle"
                  dominantBaseline="middle"
                  fontSize={8}
                  fontWeight={700}
                  fill={colours.seatText}
                  pointerEvents="none"
                >
                  {numbered ? seat + 1 : initials(guest)}
                </text>
                {name && !numbered ? (
                <text
                  textAnchor="middle"
                  dominantBaseline="central"
                  fontSize={NAME_SIZE}
                  fill={colours.name}
                  pointerEvents="none"
                >
                  {name.lines.map((line, index) => (
                    <tspan
                      key={index}
                      x={name.x}
                      y={name.y + index * name.lineHeight}
                    >
                      {line}
                    </tspan>
                  ))}
                </text>
                ) : null}
              </>
            ) : null}
          </g>
        )
      })}
      </>)}
      {layer === 'callout' && callout ? (
        <g pointerEvents="none">
          <rect
            x={callout.x}
            y={callout.y}
            width={callout.width}
            height={callout.height}
            rx={6}
            fill={colours.room}
            fillOpacity={0.94}
            stroke={colours.tableLine}
            strokeWidth={1}
          />
          <text fontSize={NAME_SIZE} fill={colours.name}>
            {callout.rows.map((row, index) => (
              <tspan
                key={row}
                x={callout.x + 7}
                y={callout.y + 5 + callout.lineHeight * (index + 0.75)}
              >
                {row}
              </tspan>
            ))}
          </text>
        </g>
      ) : null}
    </g>
  )
}

/** Corner handles to resize and a handle above to turn the selected thing. */
function Handles({
  kind,
  thing,
  r,
  colour,
}: {
  kind: 'table' | 'item'
  thing: { id: string; x: number; y: number; w: number; h: number; rotation: number }
  r: number
  colour: string
}) {
  const halfW = thing.w / 2
  const halfH = thing.h / 2
  const lift = halfH + r * 4
  const corners = [
    [-1, -1],
    [1, -1],
    [1, 1],
    [-1, 1],
  ] as const
  return (
    <g transform={`translate(${thing.x} ${thing.y}) rotate(${thing.rotation})`}>
      <rect
        x={-halfW - r}
        y={-halfH - r}
        width={thing.w + r * 2}
        height={thing.h + r * 2}
        fill="none"
        stroke={colour}
        strokeWidth={r / 4}
        strokeDasharray={`${r} ${r / 1.5}`}
        pointerEvents="none"
      />
      <line
        x1={0}
        y1={-halfH - r}
        x2={0}
        y2={-lift}
        stroke={colour}
        strokeWidth={r / 4}
        pointerEvents="none"
      />
      <circle
        data-hit="rotate"
        data-kind={kind}
        data-id={thing.id}
        cx={0}
        cy={-lift}
        r={r * 1.1}
        fill={colour}
        style={{ cursor: 'grab' }}
      >
        <title>Drag to turn (hold Shift for 15° steps)</title>
      </circle>
      {corners.map(([sx, sy]) => (
        <rect
          key={`${sx}${sy}`}
          data-hit="resize"
          data-kind={kind}
          data-id={thing.id}
          x={sx * (halfW + r) - r}
          y={sy * (halfH + r) - r}
          width={r * 2}
          height={r * 2}
          rx={r / 3}
          fill="#ffffff"
          stroke={colour}
          strokeWidth={r / 3}
          style={{ cursor: sx === sy ? 'nwse-resize' : 'nesw-resize' }}
        >
          <title>Drag to resize</title>
        </rect>
      ))}
    </g>
  )
}

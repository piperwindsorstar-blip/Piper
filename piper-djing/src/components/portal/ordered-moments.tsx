import {
  DndContext,
  KeyboardSensor,
  MouseSensor,
  TouchSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import type { DragEndEvent } from '@dnd-kit/core'
import {
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { momentFilled } from '../../lib/crm/planning.ts'
import type { TimelineRow } from '../../lib/crm/planning.ts'
import { momentSummary } from '../../lib/portal/progress.ts'
import { useCloseSheet } from './portal-chrome.tsx'
import { usePortal } from './portal-state.tsx'

export function useListSensors() {
  return useSensors(
    useSensor(MouseSensor, { activationConstraint: { distance: 4 } }),
    useSensor(TouchSensor, {
      activationConstraint: { delay: 220, tolerance: 8 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )
}

export function OrderedMoments({
  section,
  currentId,
}: {
  section: 'Ceremony' | 'Reception'
  currentId: string
}) {
  const { planning, reorderTimeline, addMoment, editTimeline, locked } =
    usePortal()
  const sensors = useListSensors()
  const [adding, setAdding] = useState(false)
  const [name, setName] = useState('')
  const [hiddenOpen, setHiddenOpen] = useState(false)
  const rows = planning.timeline.flatMap((row, index) =>
    row.section === section ? [{ row, index }] : [],
  )
  const shown = rows.filter((item) => !item.row.hidden)
  const hidden = rows.filter((item) => item.row.hidden)
  const customs = planning.timeline.filter((row) => row.presetKey === '').length

  function onDragEnd(event: DragEndEvent) {
    const overId = event.over ? String(event.over.id) : ''
    const activeId = String(event.active.id)
    if (!overId || activeId === overId) return
    reorderTimeline(section, activeId, overId)
  }

  function move(id: string, direction: -1 | 1) {
    const ids = shown.map((item) => item.row.id)
    const index = ids.indexOf(id)
    const target = ids[index + direction]
    if (!target) return
    reorderTimeline(section, id, target)
  }

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={onDragEnd}
    >
      <SortableContext
        items={shown.map((item) => item.row.id)}
        strategy={verticalListSortingStrategy}
      >
        <ol className="mt-3 grid gap-1">
          {shown.map((item, index) => (
            <MomentRow
              key={item.row.id}
              item={item}
              currentId={currentId}
              disabled={locked}
              first={index === 0}
              last={index === shown.length - 1}
              onMove={move}
            />
          ))}
        </ol>
      </SortableContext>
      {hidden.length > 0 ? (
        <div className="mt-3">
          <button
            type="button"
            className="min-h-11 text-sm text-[var(--text-muted)]"
            aria-expanded={hiddenOpen}
            onClick={() => setHiddenOpen((open) => !open)}
          >
            Hidden moments ({hidden.length})
          </button>
          {hiddenOpen ? (
            <ul className="mt-1 grid gap-1">
              {hidden.map((item) => {
                const label = item.row.label.trim() || item.row.activity
                return (
                  <li key={item.row.id}>
                    <button
                      type="button"
                      className="min-h-11 text-left text-sm text-[var(--pink-soft)] underline"
                      disabled={locked}
                      onClick={() =>
                        editTimeline(item.index, { hidden: false })
                      }
                    >
                      {label}
                    </button>
                  </li>
                )
              })}
            </ul>
          ) : null}
        </div>
      ) : null}
      {adding ? (
        <form
          className="mt-3 grid gap-2"
          onSubmit={(event) => {
            event.preventDefault()
            addMoment(section, name)
            setName('')
            setAdding(false)
          }}
        >
          <label className="block">
            <span className="sr-only">Moment name</span>
            <input
              className="portal-input"
              value={name}
              disabled={locked}
              placeholder="Unity candle"
              onChange={(event) => setName(event.target.value)}
            />
          </label>
          <button
            type="submit"
            className="min-h-11 text-left text-sm text-[var(--pink-soft)]"
            disabled={locked || name.trim() === '' || customs >= 12}
          >
            Add this moment
          </button>
        </form>
      ) : (
        <button
          type="button"
          className="mt-3 min-h-11 text-left text-sm text-[var(--text-muted)]"
          disabled={locked || customs >= 12}
          onClick={() => setAdding(true)}
        >
          + Add a moment
        </button>
      )}
    </DndContext>
  )
}

function MomentRow({
  item,
  currentId,
  disabled,
  first,
  last,
  onMove,
}: {
  item: { row: TimelineRow; index: number }
  currentId: string
  disabled: boolean
  first: boolean
  last: boolean
  onMove: (id: string, direction: -1 | 1) => void
}) {
  const close = useCloseSheet()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: item.row.id, disabled })
  const name = item.row.label.trim() || item.row.activity
  const questionId = `moment-${item.row.presetKey || item.row.id}`
  const current = questionId === currentId
  const summary = momentSummary(item.row)
  const filled = momentFilled(item.row)
  const title = item.row.time.trim()
    ? `[${item.row.time.trim()}] ${name}`
    : name
  return (
    <li
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
      }}
      className={isDragging ? 'z-10' : undefined}
      data-moment-id={item.row.id}
    >
      <div
        className={`flex items-start gap-2 rounded-[18px] px-2 py-2 ${
          current
            ? 'border-[1.5px] border-[var(--pink)] bg-[var(--pink-tint)]'
            : 'border-[1.5px] border-transparent'
        }`}
      >
        <button
          type="button"
          className="mt-1 grid h-8 w-8 shrink-0 touch-none place-items-center text-[var(--text-faint)]"
          aria-label={`Drag ${name}`}
          disabled={disabled}
          {...attributes}
          {...listeners}
        >
          <GripIcon />
        </button>
        <span
          className={`mt-2 h-3 w-3 shrink-0 rounded-full ${
            current
              ? 'bg-[var(--pink)] shadow-[0_0_0_3px_var(--pink-tint)] ring-2 ring-[var(--pink)]'
              : filled
                ? 'bg-[var(--pink)]'
                : 'border border-[var(--border-strong)]'
          }`}
          aria-hidden="true"
        />
        <span className="min-w-0 flex-1">
          <Link
            to="/portal/timeline"
            search={{ q: questionId }}
            aria-current={current ? 'step' : undefined}
            onClick={() => close()}
            className={`block text-sm ${filled || current ? 'text-white' : 'text-[var(--text-muted)]'}`}
          >
            {title}
          </Link>
          <span className="mt-0.5 block text-[13px] text-[var(--text-muted)]">
            {summary}
          </span>
        </span>
        <span className="flex shrink-0 flex-col">
          <button
            type="button"
            className="min-h-11 px-2 text-xs text-[var(--text-muted)]"
            aria-label={`Move ${name} up`}
            disabled={disabled || first}
            onClick={() => onMove(item.row.id, -1)}
          >
            Up
          </button>
          <button
            type="button"
            className="min-h-11 px-2 text-xs text-[var(--text-muted)]"
            aria-label={`Move ${name} down`}
            disabled={disabled || last}
            onClick={() => onMove(item.row.id, 1)}
          >
            Down
          </button>
        </span>
      </div>
    </li>
  )
}

function GripIcon() {
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

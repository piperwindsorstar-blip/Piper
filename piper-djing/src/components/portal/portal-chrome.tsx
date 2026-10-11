import { Link, useRouterState } from '@tanstack/react-router'
import { createContext, useContext, useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { longDate } from '../../lib/crm/dates.ts'
import { PUBLIC_EMAIL } from '../../lib/crm/defaults.ts'
import {
  overallProgress,
  sectionPercent,
  sectionProgress,
} from '../../lib/portal/progress.ts'
import type { SectionId } from '../../lib/portal/questions.ts'
import { usePortal } from './portal-state.tsx'

const STEPS = [
  { id: 'overview', label: 'Overview', to: '/portal' },
  { id: 'details', label: 'Event details', to: '/portal/details' },
  { id: 'music', label: 'Music', to: '/portal/music' },
  { id: 'appearance', label: 'Order of appearance', to: '/portal/appearance' },
  { id: 'timeline', label: 'Timeline', to: '/portal/timeline' },
] as const

type StepId = (typeof STEPS)[number]['id'] | 'review'

const SheetClose = createContext<() => void>(() => {})

export function useCloseSheet(): () => void {
  return useContext(SheetClose)
}

export function PortalChrome({ children }: { children: ReactNode }) {
  const { page, planning, saveState, savedLabel, saveError } = usePortal()
  const progress = overallProgress(planning)
  const path = useRouterState({ select: (state) => state.location.pathname })
  const current = stepFor(path)
  return (
    <div className="portal">
      <header className="hidden border-b border-[var(--border)] px-14 py-6 min-[1024px]:flex min-[1024px]:items-center min-[1024px]:justify-between">
        <Link to="/portal" aria-label="DJ Piper P">
          <img src="/brand/dj-piper-p.png" alt="" className="h-10 w-auto" />
        </Link>
        <p className="text-sm text-[var(--text-muted)]">
          {page.partnerOne} & {page.partnerTwo} · {longDate(page.eventDate)} ·{' '}
          <span className="font-bold text-[var(--pink)]">
            {progress.percent}%
          </span>{' '}
          planned
          <SaveNote
            state={saveState}
            savedLabel={savedLabel}
            error={saveError}
          />
        </p>
      </header>
      <nav
        aria-label="Plan sections"
        className="hidden border-b border-[var(--border)] px-14 py-5 min-[1024px]:block"
      >
        <ol className="flex flex-wrap items-center gap-y-3">
          {STEPS.map((step, index) => {
            const state = stepState(step.id, current, planning)
            const lineDone =
              index > 0 &&
              stepState(STEPS[index - 1].id, current, planning) === 'done'
            return (
              <li key={step.id} className="flex items-center">
                {index > 0 ? (
                  <span
                    className={`mx-3 h-0.5 w-8 ${lineDone ? 'bg-[var(--pink)]' : 'bg-[var(--line)]'}`}
                  />
                ) : null}
                <Link
                  to={step.to}
                  aria-current={state === 'current' ? 'step' : undefined}
                  className="flex items-center gap-2"
                >
                  <StepMark index={index + 1} state={state} />
                  <span
                    className={`text-sm ${state === 'upcoming' ? 'text-[var(--text-muted)]' : 'text-white'}`}
                  >
                    {step.label}
                  </span>
                </Link>
              </li>
            )
          })}
        </ol>
      </nav>
      {children}
    </div>
  )
}

function SaveNote({
  state,
  savedLabel,
  error,
}: {
  state: 'idle' | 'saving' | 'saved' | 'error'
  savedLabel: string
  error: string
}) {
  if (state === 'saving') return <span className="ml-3">Saving…</span>
  if (state === 'error') {
    return <span className="ml-3">Couldn't save, retrying. {error}</span>
  }
  if (state === 'saved' && savedLabel) {
    return <span className="ml-3">Saved · {savedLabel}</span>
  }
  return null
}

function StepMark({
  index,
  state,
}: {
  index: number
  state: 'done' | 'current' | 'upcoming'
}) {
  if (state === 'done') {
    return (
      <span className="grid h-[30px] w-[30px] place-items-center rounded-full bg-[var(--pink)] text-[#0d0d0d]">
        <CheckIcon />
      </span>
    )
  }
  if (state === 'current') {
    return (
      <span className="grid h-[30px] w-[30px] place-items-center rounded-full border border-[var(--pink)] text-sm font-bold text-[var(--pink)] shadow-[0_0_0_5px_var(--pink-tint)]">
        {index}
      </span>
    )
  }
  return (
    <span className="grid h-[30px] w-[30px] place-items-center rounded-full border border-[var(--border-strong)] text-sm text-[var(--text-muted)]">
      {index}
    </span>
  )
}

function stepFor(path: string): StepId {
  if (path.startsWith('/portal/review')) return 'review'
  if (path.startsWith('/portal/details')) return 'details'
  if (path.startsWith('/portal/music')) return 'music'
  if (path.startsWith('/portal/appearance')) return 'appearance'
  if (path.startsWith('/portal/timeline')) return 'timeline'
  return 'overview'
}

function stepState(
  id: (typeof STEPS)[number]['id'],
  current: StepId,
  planning: ReturnType<typeof usePortal>['planning'],
): 'done' | 'current' | 'upcoming' {
  if (current === 'review') {
    if (id === 'overview') return 'done'
    return sectionPercent(planning, id) === 100 ? 'done' : 'upcoming'
  }
  if (id === current) return 'current'
  if (id === 'overview') return 'done'
  return sectionPercent(planning, id) === 100 ? 'done' : 'upcoming'
}

export function PortalColumns({
  children,
  railTitle,
  railSubtitle,
  rail,
  preview,
}: {
  children: ReactNode
  railTitle: string
  railSubtitle: string
  rail: ReactNode
  preview: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <SheetClose.Provider value={() => setOpen(false)}>
      <div className="grid gap-14 px-5 py-8 min-[1024px]:grid-cols-[minmax(0,1fr)_380px] min-[1024px]:px-14 min-[1024px]:py-11">
        <div className="min-w-0 max-w-[760px] pb-56 min-[1024px]:pb-0">
          {children}
        </div>
        <aside className="sticky top-6 hidden max-h-[calc(100vh-3rem)] overflow-y-auto rounded-[24px] border border-[var(--border)] bg-[var(--surface)] p-[26px] min-[1024px]:block">
          <h2 className="portal-display text-2xl">{railTitle}</h2>
          <p className="mt-1 text-[13px] text-[var(--text-muted)]">
            {railSubtitle}
          </p>
          <div className="mt-6">{rail}</div>
        </aside>
      </div>
      <MobileSheet
        title={railTitle}
        subtitle={railSubtitle}
        open={open}
        setOpen={setOpen}
        preview={preview}
      >
        {rail}
      </MobileSheet>
    </SheetClose.Provider>
  )
}

function MobileSheet({
  title,
  subtitle,
  open,
  setOpen,
  preview,
  children,
}: {
  title: string
  subtitle: string
  open: boolean
  setOpen: (value: boolean | ((value: boolean) => boolean)) => void
  preview: ReactNode
  children: ReactNode
}) {
  const startY = useRef<number | null>(null)
  const moved = useRef(false)
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [setOpen])
  return (
    <div className="fixed inset-x-0 bottom-0 z-30 min-[1024px]:hidden">
      <div
        className={`rounded-t-[24px] border border-[var(--border)] bg-[var(--surface)] px-4 pb-4 ${open ? 'h-[85vh]' : ''}`}
      >
        <button
          type="button"
          className="flex min-h-11 w-full touch-none items-center justify-center"
          aria-expanded={open}
          onPointerDown={(event) => {
            startY.current = event.clientY
            moved.current = false
          }}
          onPointerMove={(event) => {
            if (startY.current === null) return
            if (Math.abs(event.clientY - startY.current) > 12)
              moved.current = true
          }}
          onPointerUp={(event) => {
            if (startY.current === null) return
            const delta = startY.current - event.clientY
            startY.current = null
            if (moved.current && Math.abs(delta) > 24) {
              setOpen(delta > 0)
              return
            }
            setOpen((value) => !value)
          }}
        >
          <span className="h-1.5 w-12 rounded-full bg-[var(--border-strong)]" />
          <span className="sr-only">
            {open ? 'Close the run of show' : 'Open the run of show'}
          </span>
        </button>
        {open ? (
          <div className="h-[calc(85vh-3rem)] overflow-y-auto">
            <h2 className="portal-display text-xl">{title}</h2>
            <p className="mt-1 text-[13px] text-[var(--text-muted)]">
              {subtitle}
            </p>
            <div className="mt-4">{children}</div>
          </div>
        ) : (
          <div>{preview}</div>
        )}
      </div>
    </div>
  )
}

const BAR_SEGMENTS = [
  'overview',
  'details',
  'music',
  'appearance',
  'timeline',
] as const

export function MobileQuestionBar({
  section,
  subsection,
  index,
  total,
  current,
}: {
  section: string
  subsection: string
  index: number
  total: number
  current: StepId
}) {
  const { planning } = usePortal()
  const progress = overallProgress(planning)
  return (
    <div className="mb-6 min-[1024px]:hidden">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p>
          {section}
          {subsection ? ` · ${subsection}` : ''}
        </p>
        <p className="text-[var(--text-muted)]">
          {index} of {total}
        </p>
      </div>
      <div
        className="mt-3 flex gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label="Plan progress"
      >
        {BAR_SEGMENTS.map((id) => (
          <span
            key={id}
            className="h-1 flex-1 overflow-hidden rounded-full bg-[var(--line)]"
          >
            <span
              className="block h-full bg-[var(--pink)]"
              style={{ width: segmentWidth(id, current, planning) }}
            />
          </span>
        ))}
      </div>
    </div>
  )
}

function segmentWidth(
  id: (typeof BAR_SEGMENTS)[number],
  current: StepId,
  planning: ReturnType<typeof usePortal>['planning'],
): string {
  if (id === current) return '50%'
  if (id === 'overview') return '100%'
  return sectionPercent(planning, id) === 100 ? '100%' : '0%'
}

export function sectionCounts(
  planning: ReturnType<typeof usePortal>['planning'],
  section: SectionId,
) {
  return sectionProgress(planning, section)
}

function CheckIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" aria-hidden="true">
      <path
        d="M2 7.2 5.2 10.4 12 3.6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

export function sayHelloHref(): string {
  return `mailto:${PUBLIC_EMAIL}`
}

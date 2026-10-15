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
  { id: 'timeline', label: 'Timeline', to: '/portal/timeline' },
] as const

type StepId = (typeof STEPS)[number]['id'] | 'review'

/** Every place a couple can jump to, in order. */
const JUMPS = [
  ...STEPS,
  { id: 'review', label: 'Review & send', to: '/portal/review' },
] as const

const SheetClose = createContext<() => void>(() => {})

export function useCloseSheet(): () => void {
  return useContext(SheetClose)
}

export function PortalChrome({ children }: { children: ReactNode }) {
  const { page, planning, saveState, savedLabel, saveError } = usePortal()
  const progress = overallProgress(planning, page.master)
  const path = useRouterState({ select: (state) => state.location.pathname })
  const current = stepFor(path)
  if (path.startsWith('/portal/plan')) return <div>{children}</div>
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
          <Link to="/portal/plan" className="ml-4 underline">
            Our plan
          </Link>
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
            const state = stepState(step.id, current, planning, page.master)
            const lineDone =
              index > 0 &&
              stepState(STEPS[index - 1].id, current, planning, page.master) ===
                'done'
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
          <li className="flex items-center">
            <span className="mx-3 h-0.5 w-8 bg-[var(--line)]" />
            <Link
              to="/portal/review"
              aria-current={current === 'review' ? 'step' : undefined}
              className={`text-sm ${current === 'review' ? 'text-white underline' : 'text-[var(--text-muted)]'}`}
            >
              Review & send
            </Link>
          </li>
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
  if (path.startsWith('/portal/timeline')) return 'timeline'
  return 'overview'
}

function stepState(
  id: (typeof STEPS)[number]['id'],
  current: StepId,
  planning: ReturnType<typeof usePortal>['planning'],
  master: ReturnType<typeof usePortal>['page']['master'],
): 'done' | 'current' | 'upcoming' {
  if (current === 'review') {
    if (id === 'overview') return 'done'
    return sectionPercent(planning, id, master) === 100 ? 'done' : 'upcoming'
  }
  if (id === current) return 'current'
  if (id === 'overview') return 'done'
  return sectionPercent(planning, id, master) === 100 ? 'done' : 'upcoming'
}

export function PortalColumns({
  children,
  railTitle,
  railSubtitle,
  rail,
}: {
  children: ReactNode
  railTitle: string
  railSubtitle: string
  rail: ReactNode
}) {
  const [open, setOpen] = useState(false)
  return (
    <SheetClose.Provider value={() => setOpen(false)}>
      <div className="grid gap-14 px-5 py-8 min-[1024px]:grid-cols-[minmax(0,1fr)_380px] min-[1024px]:px-14 min-[1024px]:py-11">
        <div className="min-w-0 max-w-[760px] pb-28 min-[1024px]:pb-0">
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
  children,
}: {
  title: string
  subtitle: string
  open: boolean
  setOpen: (value: boolean | ((value: boolean) => boolean)) => void
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
        className={`rounded-t-[24px] border border-[var(--border)] bg-[var(--surface)] px-4 pb-[max(0.5rem,env(safe-area-inset-bottom))] ${open ? 'h-[85vh]' : ''}`}
      >
        <button
          type="button"
          className="flex min-h-14 w-full touch-none items-center justify-between gap-3 text-left"
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
          <span className="min-w-0">
            <span className="block truncate text-[15px] font-bold">
              {title}
            </span>
            <span className="block truncate text-[13px] text-[var(--text-muted)]">
              {subtitle}
            </span>
          </span>
          <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--border-strong)] px-3 py-1.5 text-[13px] font-semibold">
            {open ? 'Close' : 'All questions'}
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.4"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
              className={open ? 'rotate-180' : ''}
            >
              <path d="M6 15l6-6 6 6" />
            </svg>
          </span>
        </button>
        {open ? (
          <div className="h-[calc(85vh-4rem)] overflow-y-auto">
            <SectionJump onNavigate={() => setOpen(false)} />
            <div>{children}</div>
          </div>
        ) : null}
      </div>
    </div>
  )
}

function SectionJump({ onNavigate }: { onNavigate: () => void }) {
  const path = useRouterState({ select: (state) => state.location.pathname })
  const current = stepFor(path)
  return (
    <nav aria-label="Jump to a section" className="mb-5">
      <p className="text-[11px] font-bold tracking-[0.16em] text-[var(--pink)] uppercase">
        Jump to
      </p>
      <ul className="mt-3 flex flex-wrap gap-2">
        {JUMPS.map((step) => (
          <li key={step.id}>
            <Link
              to={step.to}
              onClick={onNavigate}
              aria-current={step.id === current ? 'step' : undefined}
              className={`inline-flex min-h-11 items-center rounded-full border-[1.5px] px-4 text-sm font-bold ${
                step.id === current
                  ? 'border-[var(--pink)] bg-[var(--pink-tint)]'
                  : 'border-[var(--border-strong)]'
              }`}
            >
              {step.label}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  )
}

const BAR_SEGMENTS = ['overview', 'details', 'music', 'timeline'] as const

const SHORT_LABEL: Record<(typeof BAR_SEGMENTS)[number], string> = {
  overview: 'Overview',
  details: 'Details',
  music: 'Music',
  timeline: 'Timeline',
}

export function MobileQuestionBar({
  section,
  subsection,
  count,
  current,
}: {
  section: string
  subsection: string
  /** What the right side says when nothing is saving, e.g. "Question 3 of 11". */
  count: string
  current: StepId
}) {
  const { page, planning, saveState, savedLabel } = usePortal()
  const progress = overallProgress(planning, page.master)
  return (
    <div className="mb-6 min-[1024px]:hidden">
      <div className="flex items-center justify-between gap-3 text-sm">
        <p className="min-w-0 truncate">
          {section}
          {subsection && subsection !== section ? ` · ${subsection}` : ''}
        </p>
        <p className="shrink-0 text-[var(--text-muted)]" aria-live="polite">
          {saveState === 'saving'
            ? 'Saving…'
            : saveState === 'error'
              ? "Couldn't save, retrying"
              : saveState === 'saved' && savedLabel
                ? `Saved ${savedLabel}`
                : count}
        </p>
      </div>
      <div
        className="mt-1 flex gap-1.5"
        role="progressbar"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={progress.percent}
        aria-label="Plan progress"
      >
        {BAR_SEGMENTS.map((id) => {
          const step = STEPS.find((item) => item.id === id)
          return (
            <Link
              key={id}
              to={step?.to ?? '/portal'}
              aria-label={step?.label ?? id}
              aria-current={id === current ? 'step' : undefined}
              className="block flex-1 py-2"
            >
              <span className="block h-1 overflow-hidden rounded-full bg-[var(--line)]">
                <span
                  className="block h-full bg-[var(--pink)]"
                  style={{
                    width: segmentWidth(id, current, planning, page.master),
                  }}
                />
              </span>
              <span
                className={`mt-1 block truncate text-[11px] ${id === current ? 'text-white' : 'text-[var(--text-muted)]'}`}
              >
                {SHORT_LABEL[id]}
              </span>
            </Link>
          )
        })}
      </div>
    </div>
  )
}

function segmentWidth(
  id: (typeof BAR_SEGMENTS)[number],
  current: StepId,
  planning: ReturnType<typeof usePortal>['planning'],
  master: ReturnType<typeof usePortal>['page']['master'],
): string {
  if (id === 'overview') return '100%'
  if (id === 'review') return id === current ? '100%' : '0%'
  const percent = sectionPercent(planning, id, master)
  // The section you're in always shows a sliver, so you can see where you are.
  return `${id === current ? Math.max(percent, 12) : percent}%`
}

export function sectionCounts(
  planning: ReturnType<typeof usePortal>['planning'],
  section: SectionId,
  master: ReturnType<typeof usePortal>['page']['master'] = {},
) {
  return sectionProgress(planning, section, master)
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

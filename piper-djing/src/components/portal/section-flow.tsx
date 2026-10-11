import { useNavigate, useRouterState } from '@tanstack/react-router'
import { useEffect } from 'react'
import type { KeyboardEvent } from 'react'
import { djLine, stepFrom } from '../../lib/portal/progress.ts'
import {
  SECTION_LABEL,
  isVisible,
  itemAt,
  sectionPath,
  sectionQuestions,
} from '../../lib/portal/questions.ts'
import type { SectionId } from '../../lib/portal/questions.ts'
import { DjBubble } from './dj-bubble.tsx'
import {
  MobileQuestionBar,
  PortalColumns,
  sectionCounts,
} from './portal-chrome.tsx'
import { usePortal } from './portal-state.tsx'
import { QuestionControl } from './question-controls.tsx'
import { QuestionRail, neighbourIds } from './rail.tsx'

export function SectionFlow({ section }: { section: SectionId }) {
  const { planning, locked } = usePortal()
  const navigate = useNavigate()
  const q = useRouterState({
    select: (state) => {
      const search = state.location.search as { q?: string }
      return typeof search.q === 'string' ? search.q : ''
    },
  })
  const questions = sectionQuestions(planning, section)
  const visible = questions.filter((question) => isVisible(planning, question))
  const matched = questions.find((question) => question.id === q)
  const current = matched ?? itemAt(visible, 0)
  const place = current
    ? visible.findIndex((question) => question.id === current.id)
    : -1
  const currentId = current?.id
  const counts = sectionCounts(planning, section)

  useEffect(() => {
    if (!currentId) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    window.scrollTo({ top: 0, behavior: reduce ? 'auto' : 'smooth' })
  }, [currentId])

  if (!current) return null
  const question = current

  const upcoming = stepFrom(planning, question, 1)
  const nextLabel = upcoming ? upcoming.rail : 'review'

  function go(direction: 1 | -1) {
    const next = stepFrom(planning, question, direction)
    if (!next) {
      void navigate({ to: direction === 1 ? '/portal/review' : '/portal' })
      return
    }
    void navigate({ to: sectionPath(next.section), search: { q: next.id } })
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.defaultPrevented) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A'
    )
      return
    if (target.tagName === 'SELECT') return
    event.preventDefault()
    go(1)
  }

  const line = djLine(planning, question)
  const ids = neighbourIds(planning, section, question.id)

  return (
    <PortalColumns
      railTitle={SECTION_LABEL[section]}
      railSubtitle={`${counts.answered} of ${counts.total} answered`}
      rail={<QuestionRail section={section} currentId={current.id} />}
      preview={
        <QuestionRail section={section} currentId={current.id} ids={ids} />
      }
    >
      <div onKeyDown={onKeyDown}>
        <MobileQuestionBar
          section={SECTION_LABEL[section]}
          subsection={current.subsection}
          index={place < 0 ? 0 : place + 1}
          total={visible.length}
          current={section}
        />
        <p className="text-[13px] font-bold tracking-[0.16em] text-[var(--pink)] uppercase">
          {SECTION_LABEL[section]} · {current.subsection} ·{' '}
          {place < 0 ? 'Hidden' : `${place + 1} of ${visible.length}`}
        </p>
        <h1 className="portal-display mt-3 max-w-[18ch] text-[32px] leading-[1.02] break-words min-[1024px]:text-[64px]">
          {current.label}
        </h1>
        {current.helper ? (
          <p className="mt-4 max-w-[600px] text-lg text-[var(--text-muted)]">
            {current.helper}
          </p>
        ) : null}
        {locked ? (
          <p className="mt-4 text-sm text-[var(--text-muted)]">
            This plan is locked. You can read it, and you can ask for a change
            from the review.
          </p>
        ) : null}
        <div className="mt-8">
          <QuestionControl question={current} />
        </div>
        <DjBubble
          text={line}
          reserve={Boolean(
            current.djNote || current.djReplies || current.id === 'genres',
          )}
        />
        <div className="mt-8 flex flex-col gap-3 min-[1024px]:flex-row min-[1024px]:items-center">
          <button
            type="button"
            className="inline-flex min-h-11 items-center justify-center rounded-[18px] border border-[var(--border-strong)] px-5 text-base font-semibold min-[1024px]:min-h-[60px]"
            onClick={() => go(-1)}
          >
            Back
          </button>
          <button
            type="button"
            className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[18px] bg-[var(--pink)] px-6 text-base font-bold text-[#0d0d0d] min-[1024px]:min-h-[60px] min-[1024px]:w-auto"
            onClick={() => go(1)}
          >
            Next: {nextLabel} →
          </button>
          <button
            type="button"
            className="min-h-11 text-sm text-white underline min-[1024px]:ml-auto"
            onClick={() => go(1)}
          >
            Skip for now
          </button>
        </div>
      </div>
    </PortalColumns>
  )
}

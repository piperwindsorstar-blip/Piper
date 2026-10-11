import { Link } from '@tanstack/react-router'
import type { Planning } from '../../lib/crm/planning.ts'
import { railSummary } from '../../lib/portal/progress.ts'
import {
  isVisible,
  itemAt,
  sectionPath,
  sectionQuestions,
} from '../../lib/portal/questions.ts'
import type { SectionId } from '../../lib/portal/questions.ts'
import { useCloseSheet } from './portal-chrome.tsx'
import { usePortal } from './portal-state.tsx'

export function QuestionRail({
  section,
  currentId,
  ids,
}: {
  section: SectionId
  currentId: string
  ids?: string[]
}) {
  const { planning } = usePortal()
  const close = useCloseSheet()
  const questions = sectionQuestions(planning, section).filter((question) =>
    ids ? ids.includes(question.id) : true,
  )
  const groups: string[] = []
  for (const question of questions) {
    if (!groups.includes(question.group)) groups.push(question.group)
  }
  return (
    <div className="grid gap-5">
      {groups.map((group) => (
        <section key={group}>
          <h3 className="text-[11px] font-bold tracking-[0.16em] text-[var(--pink)] uppercase">
            {group}
          </h3>
          <ol className="mt-3 grid gap-1">
            {questions
              .filter((question) => question.group === group)
              .map((question) => {
                const current = question.id === currentId
                const hidden =
                  question.timelineIndex !== undefined &&
                  planning.timeline[question.timelineIndex]?.hidden === true
                const summary = hidden
                  ? 'Hidden'
                  : railSummary(planning, question)
                const filled = hidden
                  ? false
                  : summary !== '' && summary !== 'Pick a song'
                return (
                  <li key={question.id}>
                    <Link
                      to={sectionPath(section)}
                      search={{ q: question.id }}
                      aria-current={current ? 'step' : undefined}
                      onClick={() => close()}
                      className={`flex gap-3 rounded-[18px] px-3 py-2 ${
                        current
                          ? 'border-[1.5px] border-[var(--pink)] bg-[var(--pink-tint)]'
                          : 'border-[1.5px] border-transparent'
                      }`}
                    >
                      <span
                        className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                          current
                            ? 'bg-[var(--pink)] shadow-[0_0_0_3px_var(--pink-tint)] ring-2 ring-[var(--pink)]'
                            : filled
                              ? 'bg-[var(--pink)]'
                              : 'border border-[var(--border-strong)]'
                        }`}
                        aria-hidden="true"
                      />
                      <span className="min-w-0">
                        <span
                          className={`block text-sm ${filled || current ? 'text-white' : 'text-[var(--text-muted)]'}`}
                        >
                          {railTitle(
                            question.timelineIndex,
                            planning,
                            question.rail,
                          )}
                        </span>
                        {summary ? (
                          <span className="mt-0.5 block text-[13px] text-[var(--text-muted)]">
                            {summary}
                          </span>
                        ) : null}
                      </span>
                    </Link>
                  </li>
                )
              })}
          </ol>
        </section>
      ))}
    </div>
  )
}

function railTitle(
  index: number | undefined,
  planning: ReturnType<typeof usePortal>['planning'],
  fallback: string,
): string {
  if (index === undefined) return fallback
  const row = itemAt(planning.timeline, index)
  if (!row) return fallback
  const name = row.label.trim() || row.activity
  return row.time.trim() ? `[${row.time.trim()}] ${name}` : name
}

export function neighbourIds(
  planning: Planning,
  section: SectionId,
  currentId: string,
): string[] {
  const visible = sectionQuestions(planning, section).filter((question) =>
    isVisible(planning, question),
  )
  const index = visible.findIndex((question) => question.id === currentId)
  const start = Math.max(0, (index < 0 ? 0 : index) - 1)
  return visible.slice(start, start + 3).map((question) => question.id)
}

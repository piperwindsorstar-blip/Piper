import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import {
  requestPortalChange,
  sendPortalPlan,
} from '../../lib/portal/portal.functions.ts'
import {
  overallProgress,
  questionAnswered,
  sectionProgress,
} from '../../lib/portal/progress.ts'
import {
  SECTION_LABEL,
  SECTION_ORDER,
  isVisible,
  sectionPath,
  sectionQuestions,
} from '../../lib/portal/questions.ts'
import { DjBubble } from './dj-bubble.tsx'
import { MobileQuestionBar, PortalColumns } from './portal-chrome.tsx'
import { usePortal } from './portal-state.tsx'

export function ReviewScreen() {
  const { page, planning, locked, markLocked } = usePortal()
  const send = useServerFn(sendPortalPlan)
  const ask = useServerFn(requestPortalChange)
  const progress = overallProgress(planning, page.master)
  const [error, setError] = useState('')
  const [note, setNote] = useState('')
  const [asked, setAsked] = useState(false)
  const [busy, setBusy] = useState(false)

  return (
    <PortalColumns
      railTitle="Review"
      railSubtitle={`${progress.answered} of ${progress.total} answered`}
      rail={<ReviewRail />}
      preview={<ReviewRail compact />}
    >
      <MobileQuestionBar
        section="Review"
        subsection=""
        index={progress.answered}
        total={progress.total}
        current="review"
      />
      <p className="text-[13px] font-bold tracking-[0.16em] text-[var(--pink)] uppercase">
        Review · {progress.percent}% planned
      </p>
      <h1 className="portal-display mt-3 text-[32px] leading-[1.02] min-[1024px]:text-[64px]">
        Send the plan when it feels ready.
      </h1>
      <p className="mt-4 max-w-[600px] text-lg text-[var(--text-muted)]">
        Blank answers stay blank. Piper can still read everything you filled in.
      </p>
      <div className="mt-8 grid gap-6">
        {SECTION_ORDER.map((section) => {
          const counts = sectionProgress(planning, section, page.master)
          const open = sectionQuestions(planning, section, page.master).filter(
            (question) =>
              isVisible(planning, question) &&
              !questionAnswered(planning, question),
          )
          return (
            <section key={section}>
              <h2 className="text-lg font-bold">
                {SECTION_LABEL[section]}
                <span className="ml-2 text-sm font-normal text-[var(--text-muted)]">
                  {counts.answered} of {counts.total}
                </span>
              </h2>
              {open.length === 0 ? (
                <p className="mt-2 text-sm text-[var(--text-muted)]">
                  All answered.
                </p>
              ) : (
                <ul className="mt-2 grid gap-1">
                  {open.map((question) => (
                    <li key={question.id}>
                      <Link
                        to={sectionPath(section)}
                        search={{ q: question.id }}
                        className="inline-flex min-h-11 items-center text-[var(--pink-soft)] underline"
                      >
                        {question.rail}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )
        })}
      </div>
      <DjBubble
        text="Blank songs are fine. I'll pick something that fits."
        reserve
      />
      {error ? (
        <p className="mt-4 text-sm text-[var(--pink-soft)]">{error}</p>
      ) : null}
      {locked ? (
        <form
          className="mt-8 grid max-w-xl gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            setBusy(true)
            setError('')
            void ask({ data: { note } }).then((result) => {
              setBusy(false)
              if (!result.ok) {
                setError(result.error)
                return
              }
              setAsked(true)
            })
          }}
        >
          <p className="text-sm text-[var(--text-muted)]">
            This plan is locked. Ask Piper if something should change.
          </p>
          <label>
            <span className="sr-only">What should change</span>
            <textarea
              className="portal-input min-h-28 py-4"
              value={note}
              onChange={(event) => setNote(event.target.value)}
              placeholder="What should change?"
            />
          </label>
          <button
            type="submit"
            disabled={busy}
            className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[18px] bg-[var(--pink)] px-6 text-base font-bold text-[#0d0d0d] min-[1024px]:min-h-[60px] min-[1024px]:w-auto"
          >
            Request a change
          </button>
          {asked ? (
            <p className="text-sm text-[var(--text-muted)]">
              Piper has the note.
            </p>
          ) : null}
        </form>
      ) : (
        <button
          type="button"
          disabled={busy}
          className="mt-8 inline-flex min-h-[54px] w-full items-center justify-center rounded-[18px] bg-[var(--pink)] px-6 text-base font-bold text-[#0d0d0d] min-[1024px]:min-h-[60px] min-[1024px]:w-auto"
          onClick={() => {
            setBusy(true)
            setError('')
            void send().then((result) => {
              setBusy(false)
              if (!result.ok) {
                setError(result.error)
                return
              }
              markLocked(result.planning)
            })
          }}
        >
          Send my plan to Piper P
        </button>
      )}
    </PortalColumns>
  )
}

function ReviewRail({ compact = false }: { compact?: boolean }) {
  const { page, planning } = usePortal()
  const sections = compact ? SECTION_ORDER.slice(0, 3) : SECTION_ORDER
  return (
    <ol className="grid gap-2">
      {sections.map((section) => {
        const counts = sectionProgress(planning, section, page.master)
        return (
          <li key={section} className="text-sm">
            <span className="block font-bold">{SECTION_LABEL[section]}</span>
            <span className="text-[13px] text-[var(--text-muted)]">
              {counts.answered} of {counts.total}
            </span>
          </li>
        )
      })}
    </ol>
  )
}

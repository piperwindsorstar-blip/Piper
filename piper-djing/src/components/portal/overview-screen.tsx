import { Link } from '@tanstack/react-router'
import { longDate } from '../../lib/crm/dates.ts'
import {
  daysUntil,
  firstUnanswered,
  overallProgress,
  questionAnswered,
  sectionProgress,
  shiftIso,
} from '../../lib/portal/progress.ts'
import {
  SECTION_LABEL,
  SECTION_ORDER,
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
  sayHelloHref,
  useCloseSheet,
} from './portal-chrome.tsx'
import { usePortal } from './portal-state.tsx'

export function OverviewScreen() {
  const { page, planning, locked } = usePortal()
  const progress = overallProgress(planning, page.master)
  const next = firstUnanswered(planning, page.master)
  const finish = planning.dueDate || shiftIso(page.eventDate, -5)
  const days = daysUntil(page.today, page.eventDate)
  const venue = planning.venueName.trim() || page.venueName.trim() || 'Venue'
  const note = locked
    ? 'This plan is locked. You can still read every answer, and you can ask me to change it.'
    : next
      ? `Hey, it's Martin. Next up is ${next.rail} in ${SECTION_LABEL[next.section]}.`
      : "You're caught up. Send the plan when it feels right."
  return (
    <PortalColumns
      railTitle="Your plan"
      railSubtitle={`${progress.answered} of ${progress.total} answered`}
      rail={<PlanRail current={next?.section ?? null} />}
      preview={<PlanRail current={next?.section ?? null} compact />}
    >
      <MobileQuestionBar
        section="Overview"
        subsection=""
        index={progress.answered}
        total={progress.total}
        current="overview"
      />
      <p className="text-[13px] font-bold tracking-[0.16em] text-[var(--pink)] uppercase">
        {longDate(page.eventDate)} · {venue}
      </p>
      <h1 className="portal-display mt-3 text-[32px] leading-[1.02] break-words min-[1024px]:text-[64px]">
        Hi {page.partnerOne} & {page.partnerTwo}. Let's plan your night.
      </h1>
      <p className="mt-4 max-w-[600px] text-lg text-[var(--text-muted)]">
        One question at a time. Answer what you know, skip what you don't, and
        come back whenever.
      </p>
      <div className="mt-8 grid gap-3 min-[1024px]:grid-cols-3">
        <Stat value={String(days)} label="days to go" />
        <Stat value={`${progress.percent}%`} label="planned" pink />
        <Stat
          value={finish ? longDate(finish) : '—'}
          label={planning.dueDate ? 'finish by' : 'suggested finish'}
        />
      </div>
      <DjBubble text={note} reserve />
      <div className="mt-8 flex flex-col gap-4 min-[1024px]:flex-row min-[1024px]:items-center">
        {next ? (
          <Link
            to={sectionPath(next.section)}
            search={{ q: next.id }}
            className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[18px] bg-[var(--pink)] px-6 text-base font-bold text-[#0d0d0d] min-[1024px]:min-h-[60px] min-[1024px]:w-auto"
          >
            Continue: {SECTION_LABEL[next.section]} →
          </Link>
        ) : (
          <Link
            to="/portal/review"
            className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[18px] bg-[var(--pink)] px-6 text-base font-bold text-[#0d0d0d] min-[1024px]:min-h-[60px] min-[1024px]:w-auto"
          >
            Continue: review →
          </Link>
        )}
        <a
          href={sayHelloHref()}
          className="inline-flex min-h-11 items-center text-sm underline"
        >
          Say hello
        </a>
      </div>
    </PortalColumns>
  )
}

function Stat({
  value,
  label,
  pink = false,
}: {
  value: string
  label: string
  pink?: boolean
}) {
  return (
    <div className="rounded-[18px] bg-[var(--field)] px-4 py-5">
      <p
        className={`portal-display text-3xl ${pink ? 'text-[var(--pink)]' : 'text-white'}`}
      >
        {value}
      </p>
      <p className="mt-1 text-sm text-[var(--text-muted)]">{label}</p>
    </div>
  )
}

function PlanRail({
  current,
  compact = false,
}: {
  current: SectionId | null
  compact?: boolean
}) {
  const { page, planning } = usePortal()
  const master = page.master
  const close = useCloseSheet()
  const sections = compact ? compactSections(current) : SECTION_ORDER
  return (
    <div className="grid gap-5">
      <ol className="grid gap-1">
        {sections.map((section) => {
          const progress = sectionProgress(planning, section, master)
          const open = sectionQuestions(planning, section, master).filter(
            (question) =>
              isVisible(planning, question) &&
              !questionAnswered(planning, question),
          )
          const firstOpen = itemAt(open, 0)
          const target =
            firstOpen ??
            sectionQuestions(planning, section, master).find((question) =>
              isVisible(planning, question),
            )
          const active = section === current
          const done =
            progress.total > 0 && progress.answered === progress.total
          const summary =
            progress.answered === 0
              ? 'Not started'
              : done
                ? `Done · ${progress.answered} of ${progress.total}`
                : `${progress.answered} of ${progress.total}${firstOpen ? ` · up next: ${firstOpen.rail}` : ''}`
          if (!target) return null
          return (
            <li key={section}>
              <Link
                to={sectionPath(section)}
                search={{ q: target.id }}
                aria-current={active ? 'step' : undefined}
                onClick={() => close()}
                className={`flex gap-3 rounded-[18px] px-3 py-2 ${
                  active
                    ? 'border-[1.5px] border-[var(--pink)] bg-[var(--pink-tint)]'
                    : 'border-[1.5px] border-transparent'
                }`}
              >
                <span
                  className={`mt-1 h-3 w-3 shrink-0 rounded-full ${
                    done
                      ? 'bg-[var(--pink)]'
                      : 'border border-[var(--border-strong)]'
                  }`}
                  aria-hidden="true"
                />
                <span>
                  <span className="block text-sm">
                    {SECTION_LABEL[section]}
                  </span>
                  <span className="mt-0.5 block text-[13px] text-[var(--text-muted)]">
                    {summary}
                  </span>
                </span>
              </Link>
            </li>
          )
        })}
      </ol>
      {compact ? null : (
        <section>
          <h3 className="text-[11px] font-bold tracking-[0.16em] text-[var(--pink)] uppercase">
            Your DJ
          </h3>
          <div className="mt-3 grid gap-3 text-sm">
            <p>
              <span className="block font-bold">
                {planning.djName.trim() || 'Martin Piper · DJ Piper P'}
              </span>
              <span className="text-[var(--text-muted)]">
                Arrives {planning.arrivalTime.trim() || 'later'}
              </span>
            </p>
            <p>
              <span className="block font-bold">Package</span>
              <span className="text-[var(--text-muted)]">
                {page.packageName}
              </span>
            </p>
            {page.invoiceSlug ? (
              <Link
                to="/p/$slug"
                params={{ slug: page.invoiceSlug }}
                className="inline-flex min-h-11 items-center underline"
              >
                Invoice
              </Link>
            ) : null}
          </div>
        </section>
      )}
    </div>
  )
}

function compactSections(current: SectionId | null): SectionId[] {
  const index = current ? SECTION_ORDER.indexOf(current) : 0
  const start = Math.max(0, index - 1)
  return SECTION_ORDER.slice(start, start + 3)
}

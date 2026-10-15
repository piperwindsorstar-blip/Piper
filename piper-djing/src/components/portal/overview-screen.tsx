import { Link } from '@tanstack/react-router'
import { useState } from 'react'
import { longDate } from '../../lib/crm/dates.ts'
import {
  answeredLabel,
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
      railSubtitle={answeredLabel(planning, page.master)}
      rail={<PlanRail current={next?.section ?? null} />}
    >
      <MobileQuestionBar
        section="Overview"
        subsection=""
        count={`${progress.percent}% planned`}
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
      <div className="mt-6 grid grid-cols-3 gap-2 min-[1024px]:mt-8 min-[1024px]:gap-3">
        <Stat value={days < 0 ? '0' : String(days)} label={days === 1 ? 'day to go' : 'days to go'} />
        <Stat value={`${progress.percent}%`} label="planned" pink />
        <Stat
          value={finish ? shortDate(finish) : '—'}
          label={planning.dueDate ? 'finish by' : 'suggested finish'}
          title={finish ? longDate(finish) : undefined}
        />
      </div>
      {!locked && !planning.email.trim() ? <EmailAsk /> : null}
      <div className="mt-6 flex flex-col gap-4 min-[1024px]:mt-8 min-[1024px]:flex-row min-[1024px]:items-center">
        {next ? (
          <Link
            to={sectionPath(next.section)}
            search={{ q: next.id }}
            className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[18px] bg-[var(--pink)] px-6 text-base font-bold text-[#0d0d0d] min-[1024px]:min-h-[60px] min-[1024px]:w-auto"
          >
            {progress.answered === 0 ? 'Start' : 'Continue'}: {next.rail}
          </Link>
        ) : (
          <Link
            to="/portal/review"
            className="inline-flex min-h-[54px] w-full items-center justify-center rounded-[18px] bg-[var(--pink)] px-6 text-base font-bold text-[#0d0d0d] min-[1024px]:min-h-[60px] min-[1024px]:w-auto"
          >
            Review and send
          </Link>
        )}
        <div className="flex gap-6">
          <Link
            to="/portal/plan"
            className="inline-flex min-h-11 items-center text-sm underline"
          >
            See our plan
          </Link>
          <a
            href={sayHelloHref()}
            className="inline-flex min-h-11 items-center text-sm underline"
          >
            Say hello
          </a>
        </div>
      </div>
      <DjBubble text={note} reserve />
    </PortalColumns>
  )
}

/** Asked once, up front, when there is no email to reach the couple at. */
function EmailAsk() {
  const { editText } = usePortal()
  const [value, setValue] = useState('')
  const [error, setError] = useState('')
  return (
    <form
      className="mt-6 grid gap-3 rounded-[18px] border-[1.5px] border-[var(--pink)] bg-[var(--pink-tint)] p-4 min-[1024px]:mt-8 min-[1024px]:p-5"
      onSubmit={(event) => {
        event.preventDefault()
        const email = value.trim()
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
          setError('Check the email address.')
          return
        }
        setError('')
        editText('email', email)
      }}
    >
      <label className="grid gap-2">
        <span className="text-base font-bold">What email should I use?</span>
        <span className="text-sm text-[var(--text-muted)]">
          For your invoice, receipts and a heads-up before your plan is due.
        </span>
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          required
          value={value}
          onChange={(event) => setValue(event.target.value)}
          className="min-h-12 w-full min-w-0 rounded-[14px] border border-[var(--border-strong)] bg-[var(--field)] px-4 text-base text-white"
          placeholder="you@example.com"
        />
      </label>
      {error ? (
        <p className="text-sm text-[var(--pink)]" role="alert">
          {error}
        </p>
      ) : null}
      <button
        type="submit"
        className="inline-flex min-h-12 w-full items-center justify-center rounded-[14px] bg-white px-5 text-base font-bold text-[#0d0d0d] min-[1024px]:w-fit"
      >
        Save email
      </button>
    </form>
  )
}

function Stat({
  value,
  label,
  pink = false,
  title,
}: {
  value: string
  label: string
  pink?: boolean
  title?: string
}) {
  return (
    <div className="min-w-0 rounded-[14px] bg-[var(--field)] px-3 py-3 min-[1024px]:rounded-[18px] min-[1024px]:px-4 min-[1024px]:py-5" title={title}>
      <p
        className={`portal-display truncate text-[22px] min-[1024px]:text-3xl ${pink ? 'text-[var(--pink)]' : 'text-white'}`}
      >
        {value}
      </p>
      <p className="mt-0.5 text-xs text-[var(--text-muted)] min-[1024px]:mt-1 min-[1024px]:text-sm">{label}</p>
    </div>
  )
}

/** "Sep 12" for the small finish-by tile; the full date sits in its title. */
function shortDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
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

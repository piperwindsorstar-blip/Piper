import { Link, createFileRoute, notFound } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import type { KeyboardEvent } from 'react'
import {
  DeskTitle,
  deskGhost,
  deskPrimary,
  deskSurface,
} from '../../../../components/desk-ui.tsx'
import { QuestionControl } from '../../../../components/portal/question-controls.tsx'
import {
  PortalProvider,
  usePortal,
} from '../../../../components/portal/portal-state.tsx'
import type { PortalPage } from '../../../../components/portal/portal-state.tsx'
import { longDate } from '../../../../lib/crm/dates.ts'
import {
  getCouplePortalDesk,
  saveCouplePasscodeDesk,
  saveDeskPlan,
} from '../../../../lib/crm/desk.functions.ts'
import { deskHead } from '../../../../lib/desk-head.ts'
import {
  SECTION_LABEL,
  SECTION_ORDER,
  itemAt,
  sectionQuestions,
} from '../../../../lib/portal/questions.ts'
import type { SectionId } from '../../../../lib/portal/questions.ts'
import { ActionButton } from '../../../../components/action-button.tsx'
import type { RunResult } from '../../../../components/action-button.tsx'

export const Route = createFileRoute('/desk/portals/$slug/')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Couple portal · DJ Piper P'),
  loader: async ({ params }) => {
    const page = await getCouplePortalDesk({ data: { slug: params.slug } })
    if (!page) throw notFound()
    return page
  },
  component: CouplePortalPage,
})

function CouplePortalPage() {
  const page = Route.useLoaderData()
  const save = useServerFn(saveDeskPlan)
  const portalPage: PortalPage = {
    partnerOne: page.partnerOne,
    partnerTwo: page.partnerTwo,
    eventDate: page.eventDate,
    packageName: page.packageName,
    venueName: page.venueName,
    invoiceSlug: page.invoiceSlug,
    slug: page.slug,
    today: page.today,
    locked: false,
    planning: page.planning,
    master: page.master,
  }
  return (
    <div className="grid gap-5">
      <DeskTitle
        kicker="Couple portal"
        title={`${page.partnerOne} & ${page.partnerTwo}`}
      >
        <p className="mt-2 text-sm text-white/70">
          {`${longDate(page.eventDate) ?? ''} · Answers save on this wedding only.`}</p>
      </DeskTitle>
      {page.locked ? (
        <p className="rounded-2xl border border-neon/40 bg-neon/10 px-4 py-3 text-sm">
          This plan is locked for the couple. You can still edit it here.
        </p>
      ) : null}
      <PasscodeEditor slug={page.slug} passcode={page.passcode} />
      <div className="flex flex-wrap gap-2">
        <Link to="/desk/portals" className={deskGhost}>
          All portals
        </Link>
        <Link to="/c/$slug" params={{ slug: page.slug }} className={deskGhost}>
          Open their link
        </Link>
        <Link
          to="/desk/portals/$slug/plan"
          params={{ slug: page.slug }}
          className={deskGhost}
        >
          Our plan
        </Link>
      </div>
      <PortalProvider
        page={portalPage}
        saver={(planning) => save({ data: { slug: page.slug, planning } })}
      >
        <AnswerEditor />
      </PortalProvider>
    </div>
  )
}

function PasscodeEditor({
  slug,
  passcode,
}: {
  slug: string
  passcode: string
}) {
  const save = useServerFn(saveCouplePasscodeDesk)
  const [value, setValue] = useState(passcode)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState('')
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="field min-w-40">
        Passcode
        <input
          value={value}
          autoComplete="off"
          spellCheck={false}
          onChange={(event) => setValue(event.target.value.toUpperCase())}
        />
      </label>
      <ActionButton
        className={deskPrimary}
        checkForm
        busy="Saving…"
        done="Saved"
        surface={deskSurface}
        onRun={async (): Promise<RunResult | undefined> => {
          setError('')
          setSaved('')
          const result = await save({ data: { slug, passcode: value } })
          if (!result.ok) {
            setError(result.error)
            return { ok: false, message: result.error }
          }
          setValue(result.passcode)
          setSaved('Passcode saved.')
          return { ok: true, message: 'Passcode saved.' }
        }}
      >
        Save passcode
      </ActionButton>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      {saved ? <p className="text-sm text-white/80">{saved}</p> : null}
    </form>
  )
}

function AnswerEditor() {
  const { page, planning, saveState, saveError } = usePortal()
  const [section, setSection] = useState<SectionId>('details')
  const [currentId, setCurrentId] = useState('weddingDate')
  const questions = sectionQuestions(planning, section, page.master).filter(
    (question) => !question.hiddenByMaster,
  )
  const index = Math.max(
    0,
    questions.findIndex((question) => question.id === currentId),
  )
  const current = itemAt(questions, index)
  if (!current) return null
  const upcoming = itemAt(questions, index + 1)

  function go(direction: 1 | -1) {
    const next = itemAt(questions, index + direction)
    if (!next) return
    setCurrentId(next.id)
  }

  function onKeyDown(event: KeyboardEvent) {
    if (event.key !== 'Enter' || event.defaultPrevented) return
    const target = event.target
    if (!(target instanceof HTMLElement)) return
    if (
      target.tagName === 'TEXTAREA' ||
      target.tagName === 'BUTTON' ||
      target.tagName === 'A' ||
      target.tagName === 'SELECT'
    )
      return
    event.preventDefault()
    go(1)
  }

  return (
    <div
      className="portal rounded-3xl border border-white/10 p-5 md:p-8"
      onKeyDown={onKeyDown}
    >
      <div className="mb-6 flex flex-wrap gap-2">
        {SECTION_ORDER.map((id) => (
          <button
            key={id}
            type="button"
            className={id === section ? deskPrimary : deskGhost}
            onClick={() => {
              setSection(id)
              const first = sectionQuestions(planning, id, page.master).find(
                (question) => !question.hiddenByMaster,
              )
              if (first) setCurrentId(first.id)
            }}
          >
            {SECTION_LABEL[id]}
          </button>
        ))}
      </div>
      <p className="text-sm text-[var(--text-muted)]">
        {SECTION_LABEL[section]}
        {saveState === 'saving' ? ' · Saving…' : ''}
        {saveState === 'saved' ? ' · Saved' : ''}
        {saveState === 'error' ? ` · ${saveError}` : ''}
      </p>
      <h2 className="portal-display mt-3 text-[32px] leading-[1.02]">
        {current.label}
      </h2>
      {current.helper ? (
        <p className="mt-3 text-[var(--text-muted)]">{current.helper}</p>
      ) : null}
      <div className="mt-6">
        <QuestionControl question={current} />
      </div>
      <div className="mt-8 flex flex-wrap gap-2">
        <button type="button" className={deskGhost} onClick={() => go(-1)}>
          Back
        </button>
        <button type="button" className={deskPrimary} onClick={() => go(1)}>
          {upcoming ? `Next: ${upcoming.rail}` : 'Done'}
        </button>
      </div>
    </div>
  )
}

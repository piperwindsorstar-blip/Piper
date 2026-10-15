import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import {
  Chip,
  DeskTitle,
  deskCard,
  deskGhost,
  deskPrimary,
  deskSurface,
} from '../../../components/desk-ui.tsx'
import { longDate } from '../../../lib/crm/dates.ts'
import {
  getPortalDesk,
  saveCoupleEmailDesk,
  saveCouplePasscodeDesk,
  savePlanRemindersDesk,
  savePortalMasterDesk,
} from '../../../lib/crm/desk.functions.ts'
import type { NudgeRow } from '../../../lib/portal/nudges.ts'
import { shiftIso } from '../../../lib/portal/progress.ts'
import { deskHead } from '../../../lib/desk-head.ts'
import { SECTION_LABEL, SECTION_ORDER } from '../../../lib/portal/questions.ts'
import type { MasterDraft } from '../../../lib/portal/master.ts'
import { ActionButton } from '../../../components/action-button.tsx'
import type { RunResult } from '../../../components/action-button.tsx'

export const Route = createFileRoute('/desk/portals/')({
  head: () => deskHead('Portals · DJ Piper P'),
  loader: () => getPortalDesk(),
  component: PortalsPage,
})

function PortalsPage() {
  const data = Route.useLoaderData()
  const saveMaster = useServerFn(savePortalMasterDesk)
  const router = useRouter()
  const [drafts, setDrafts] = useState(data.drafts)
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    setDrafts(data.drafts)
  }, [data.drafts])

  return (
    <div className="grid gap-8">
      <DeskTitle kicker="Portals" title="Couple portals">
        <p className="mt-2 max-w-2xl text-sm text-white/70">
          Question wording here is what every couple sees. Their answers stay on
          their own plan.
        </p>
      </DeskTitle>
      <PlanReminders
        on={data.nudges.on}
        lastRun={data.nudges.lastRun}
        missing={data.nudges.rows.filter((row) => !row.email).length}
      />
      <section className="grid gap-3">
        <h2 className="font-display text-2xl font-extrabold">Couples</h2>
        {data.portals.length === 0 ? (
          <p className="text-sm text-white/70">No couple portals yet.</p>
        ) : (
          data.portals.map((portal) => (
            <article key={portal.slug} className={`${deskCard} grid gap-3`}>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-bold">
                  {portal.partnerOne} & {portal.partnerTwo}
                </h3>
                {portal.sample ? <Chip tone="amber">TEST</Chip> : null}
                {portal.locked ? <Chip tone="pink">Locked</Chip> : null}
              </div>
              <p className="text-sm text-white/70">
                {longDate(portal.eventDate)} · {portal.percent}% planned ·{' '}
                {portal.answered} of {portal.total}
              </p>
              <ReminderLine
                row={data.nudges.rows.find((row) => row.slug === portal.slug)}
                on={data.nudges.on}
              />
              <EmailField slug={portal.slug} email={data.emails[portal.slug] ?? ''} />
              <PasscodeField slug={portal.slug} passcode={portal.passcode} />
              <div className="flex flex-wrap gap-2">
                <Link
                  to="/desk/portals/$slug"
                  params={{ slug: portal.slug }}
                  className={deskPrimary}
                >
                  Edit answers
                </Link>
                <Link
                  to="/c/$slug"
                  params={{ slug: portal.slug }}
                  className={deskGhost}
                >
                  Open their link
                </Link>
              </div>
            </article>
          ))
        )}
      </section>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl font-extrabold">
          Questions on every portal
        </h2>
        {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
        {SECTION_ORDER.map((section) => (
          <details
            key={section}
            className={deskCard}
            open={section === 'details'}
          >
            <summary className="cursor-pointer text-lg font-bold">
              {SECTION_LABEL[section]}
            </summary>
            <div className="mt-4 grid gap-4">
              {drafts
                .filter((draft) => draft.section === section)
                .map((draft) => (
                  <QuestionDraft
                    key={draft.id}
                    draft={draft}
                    onChange={(next) =>
                      setDrafts((current) =>
                        current.map((item) =>
                          item.id === next.id ? next : item,
                        ),
                      )
                    }
                  />
                ))}
            </div>
          </details>
        ))}
        <button
          type="button"
          className={`${deskPrimary} w-fit`}
          disabled={busy}
          onClick={() => {
            setBusy(true)
            void saveMaster({ data: { drafts } }).then(async (result) => {
              setNotice(result.ok ? 'Saved on every portal.' : result.error)
              setBusy(false)
              if (result.ok) await router.invalidate()
            })
          }}
        >
          Save question wording
        </button>
      </section>
    </div>
  )
}

function PlanReminders({
  on,
  lastRun,
  missing,
}: {
  on: boolean
  lastRun: { ranAt: string; note: string } | null
  missing: number
}) {
  const save = useServerFn(savePlanRemindersDesk)
  const router = useRouter()
  return (
    <section className={deskCard} aria-labelledby="plan-reminders">
      <h2 id="plan-reminders" className="font-display text-xl font-bold">
        Plan reminders
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-relaxed text-white/85">
        {on
          ? 'On. Booked couples whose plan is not finished get a short email from you 8, 4, 2 and 1 weeks before their finish-by date, 2 days before, and once if it passes. Each one goes once, and a finished or locked plan gets nothing.'
          : 'Off. No plan reminders go out. Couples can still open their plan any time.'}
      </p>
      {missing > 0 ? (
        <p className="mt-2 text-sm text-amber-200">
          {missing === 1 ? '1 booked couple has' : `${missing} booked couples have`} no email on
          file, so reminders, invoices and receipts can't reach them. Add it on their card below,
          or they'll be asked for it the next time they open their plan.
        </p>
      ) : null}
      {lastRun ? (
        <p className="mt-2 text-xs text-white/55">
          Last daily run {new Date(lastRun.ranAt).toLocaleString('en-CA', { timeZone: 'America/Toronto', dateStyle: 'medium', timeStyle: 'short' })}
          {' · '}
          {lastRun.note}
        </p>
      ) : null}
      <ActionButton
        className={`${on ? deskGhost : deskPrimary} mt-4 w-fit`}
        busy={on ? 'Turning off…' : 'Turning on…'}
        done={on ? 'Off' : 'On'}
        surface={deskSurface}
        onRun={async (): Promise<RunResult> => {
          const result = await save({ data: { on: !on } })
          if (result.ok) await router.invalidate()
          return result.ok
            ? { ok: true, message: result.on ? 'Plan reminders are on.' : 'Plan reminders are off.' }
            : { ok: false, message: result.error }
        }}
      >
        {on ? 'Turn off plan reminders' : 'Turn on plan reminders'}
      </ActionButton>
    </section>
  )
}

function shortDay(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number)
  if (!year || !month || !day) return iso
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-CA', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  })
}

function ReminderLine({ row, on }: { row: NudgeRow | undefined; on: boolean }) {
  if (!row || !on) return null
  const last = row.last
    ? `Last reminder: ${row.last.step}, ${new Date(row.last.at).toLocaleDateString('en-CA', { timeZone: 'America/Toronto', month: 'short', day: 'numeric' })}${row.last.delivered ? '' : ` (not sent: ${row.last.detail})`}`
    : ''
  const noEmail = !row.email
  const status = row.block === 'More than 8 weeks to go'
    ? `Finish by ${shortDay(row.finish)}. First reminder around ${shortDay(shiftIso(row.finish, -60))}.${noEmail ? ' Add their email before then.' : ''}`
    : row.block
      ? row.block === 'No email on file'
        ? `Finish by ${shortDay(row.finish)}. No email on file, so no reminders.`
        : `Finish by ${shortDay(row.finish)}. ${row.block}.`
      : `Finish by ${shortDay(row.finish)}. Reminder window: ${row.due}.`
  return (
    <p className={`text-sm ${noEmail ? 'text-amber-200' : 'text-white/70'}`}>
      {status}
      {last ? <span className="block text-white/55">{last}</span> : null}
    </p>
  )
}

function EmailField({ slug, email }: { slug: string; email: string }) {
  const save = useServerFn(saveCoupleEmailDesk)
  const router = useRouter()
  const [value, setValue] = useState(email)
  const [error, setError] = useState('')
  useEffect(() => {
    setValue(email)
  }, [email])
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(event) => event.preventDefault()}
    >
      <label className="field min-w-64 flex-1 sm:flex-none">
        Couple email
        <input
          type="email"
          value={value}
          autoComplete="off"
          spellCheck={false}
          placeholder="Not on file yet"
          onChange={(event) => setValue(event.target.value)}
        />
      </label>
      <ActionButton
        className={deskGhost}
        checkForm
        busy="Saving…"
        done="Saved"
        surface={deskSurface}
        onRun={async (): Promise<RunResult | undefined> => {
          setError('')
          const result = await save({ data: { slug, email: value } })
          if (!result.ok) {
            setError(result.error)
            return { ok: false, message: result.error }
          }
          setValue(result.email)
          await router.invalidate()
          return { ok: true, message: result.email ? 'Email saved.' : 'Email cleared.' }
        }}
      >
        Save email
      </ActionButton>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </form>
  )
}

function PasscodeField({ slug, passcode }: { slug: string; passcode: string }) {
  const save = useServerFn(saveCouplePasscodeDesk)
  const [value, setValue] = useState(passcode)
  const [error, setError] = useState('')
  useEffect(() => {
    setValue(passcode)
  }, [passcode])
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
        className={deskGhost}
        checkForm
        busy="Saving…"
        done="Saved"
        surface={deskSurface}
        onRun={async (): Promise<RunResult | undefined> => {
          setError('')
          const result = await save({ data: { slug, passcode: value } })
          if (!result.ok) {
            setError(result.error)
            return { ok: false, message: result.error }
          }
          setValue(result.passcode)
          return { ok: true, message: 'Passcode saved.' }
        }}
      >
        Save passcode
      </ActionButton>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
    </form>
  )
}

function QuestionDraft({
  draft,
  onChange,
}: {
  draft: MasterDraft
  onChange: (draft: MasterDraft) => void
}) {
  function patch(next: Partial<MasterDraft>) {
    onChange({ ...draft, ...next })
  }
  return (
    <div className="grid gap-3 border-t border-white/10 pt-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-white/55">{draft.subsection}</p>
        <button
          type="button"
          className={deskGhost}
          onClick={() =>
            patch({
              label: draft.defaults.label,
              helper: draft.defaults.helper,
              rail: draft.defaults.rail,
              djNote: draft.defaults.djNote,
              hidden: false,
              chips: draft.defaults.chips,
              options: draft.defaults.options.map((option) => ({ ...option })),
              replies: draft.defaults.replies.map((reply) => ({ ...reply })),
            })
          }
        >
          Reset to default
        </button>
      </div>
      <label className="field">
        Question
        <input
          value={draft.label}
          onChange={(event) => patch({ label: event.target.value })}
        />
      </label>
      <label className="field">
        Helper
        <input
          value={draft.helper}
          onChange={(event) => patch({ helper: event.target.value })}
        />
      </label>
      <label className="field">
        Short name
        <input
          value={draft.rail}
          onChange={(event) => patch({ rail: event.target.value })}
        />
      </label>
      <label className="field">
        DJ note
        <textarea
          value={draft.djNote}
          onChange={(event) => patch({ djNote: event.target.value })}
        />
      </label>
      <label className="flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={draft.hidden}
          onChange={(event) => patch({ hidden: event.target.checked })}
        />
        Hide on every portal
      </label>
      {draft.type === 'chips' ? (
        <label className="field">
          Chips, one per line
          <textarea
            value={draft.chips}
            onChange={(event) => patch({ chips: event.target.value })}
          />
        </label>
      ) : null}
      {draft.options.length > 0 ? (
        <div className="grid gap-2">
          {draft.options.map((option) => (
            <label key={option.value} className="field">
              Hint for {option.value}
              <input
                value={option.hint}
                onChange={(event) =>
                  patch({
                    options: draft.options.map((item) =>
                      item.value === option.value
                        ? { ...item, hint: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
      ) : null}
      {draft.replies.length > 0 ? (
        <div className="grid gap-2">
          {draft.replies.map((reply) => (
            <label key={reply.value} className="field">
              Reply when they pick {reply.value}
              <textarea
                value={reply.text}
                onChange={(event) =>
                  patch({
                    replies: draft.replies.map((item) =>
                      item.value === reply.value
                        ? { ...item, text: event.target.value }
                        : item,
                    ),
                  })
                }
              />
            </label>
          ))}
        </div>
      ) : null}
    </div>
  )
}

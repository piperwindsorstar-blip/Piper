import { Link, createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import {
  Chip,
  DeskTitle,
  deskCard,
  deskGhost,
  deskPrimary,
} from '../../../components/desk-ui.tsx'
import { longDate } from '../../../lib/crm/dates.ts'
import {
  getPortalDesk,
  saveCouplePasscodeDesk,
  savePortalMasterDesk,
} from '../../../lib/crm/desk.functions.ts'
import { deskHead } from '../../../lib/desk-head.ts'
import { SECTION_LABEL, SECTION_ORDER } from '../../../lib/portal/questions.ts'
import type { MasterDraft } from '../../../lib/portal/master.ts'

export const Route = createFileRoute('/desk/portals/')({
  head: () => deskHead('Portals · Piper DJing'),
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
      onSubmit={(event) => {
        event.preventDefault()
        setError('')
        void save({ data: { slug, passcode: value } }).then((result) => {
          if (!result.ok) {
            setError(result.error)
            return
          }
          setValue(result.passcode)
        })
      }}
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
      <button type="submit" className={deskGhost}>
        Save passcode
      </button>
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

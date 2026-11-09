import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskPrimary,
  deskSurface,
} from '../../components/desk-ui.tsx'
import { getTermsPage, saveTerms } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'

export const Route = createFileRoute('/desk/terms')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Terms · DJ Piper P'),
  loader: () => getTermsPage(),
  component: TermsPage,
})

function TermsPage() {
  const data = Route.useLoaderData()
  const save = useServerFn(saveTerms)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <form className="grid gap-5" onSubmit={(event) => event.preventDefault()}>
      <DeskTitle kicker="Terms" title="Terms">
        <p className="mt-1 text-sm text-white/65">
          One document. Change it here. Do not add a second.
        </p>
      </DeskTitle>
      <div className={deskCard}>
        <label htmlFor="terms" className="sr-only">
          Terms
        </label>
        <textarea
          id="terms"
          name="body"
          rows={16}
          required
          defaultValue={data.body}
          className="leading-relaxed"
        />
        <ActionButton
          className={`${deskPrimary} mt-4`}
          checkForm
          busy="Saving…"
          done="Saved"
          surface={deskSurface}
          onRun={async (form: FormData): Promise<RunResult | undefined> => {
            const body = String(form.get('body') ?? '')
            if (!body.trim()) {
              const message = 'The terms cannot be empty.'
              setNotice(message)
              return { ok: false, message }
            }
            const result = await save({ data: { body } })
            setNotice(result.ok ? 'The terms are updated.' : result.error)
            if (result.ok) await router.invalidate()
            return {
              ok: result.ok,
              message: result.ok ? 'The terms are updated.' : result.error,
            }
          }}
        >
          Save the terms
        </ActionButton>
      </div>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
    </form>
  )
}

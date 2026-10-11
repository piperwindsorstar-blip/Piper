import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { DeskTitle, deskCard, deskPrimary } from '../../components/desk-ui.tsx'
import { getTermsPage, saveTerms } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/terms')({
  head: () => deskHead('Terms · Piper DJing'),
  loader: () => getTermsPage(),
  component: TermsPage,
})

function TermsPage() {
  const data = Route.useLoaderData()
  const save = useServerFn(saveTerms)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <form
      className="grid gap-5"
      onSubmit={(event) => {
        event.preventDefault()
        const body = String(new FormData(event.currentTarget).get('body') ?? '')
        void save({ data: { body } }).then(async (result) => {
          setNotice(result.ok ? 'The terms are updated.' : result.error)
          if (result.ok) await router.invalidate()
        })
      }}
    >
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
          defaultValue={data.body}
          className="leading-relaxed"
        />
        <button type="submit" className={`${deskPrimary} mt-4`}>
          Save the terms
        </button>
      </div>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
    </form>
  )
}

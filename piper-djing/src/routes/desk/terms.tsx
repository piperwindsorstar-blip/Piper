import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getTermsPage, saveTerms } from '../../lib/crm/desk.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/terms')({
  head: () => privateHead('Terms · Piper DJing'),
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
      className="grid gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        const body = String(new FormData(event.currentTarget).get('body') ?? '')
        void save({ data: { body } }).then(async (result) => {
          setNotice(result.ok ? 'The terms are updated.' : result.error)
          if (result.ok) await router.invalidate()
        })
      }}
    >
      <h1 className="font-display text-4xl tracking-tight">Terms</h1>
      <p className="text-sm text-muted">One document. Change it here. Do not add a second.</p>
      <textarea name="body" rows={16} defaultValue={data.body} className="field w-full" />
      <button type="submit" className="min-h-11 w-fit rounded-full bg-ink px-5 text-sm text-ivory">
        Save the terms
      </button>
      {notice ? <p className="text-sm">{notice}</p> : null}
    </form>
  )
}

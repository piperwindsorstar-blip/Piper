import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getQuestions, saveQuestion } from '../../lib/crm/desk.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/questions')({
  head: () => privateHead('Questions · Piper DJing'),
  loader: () => getQuestions(),
  component: QuestionsPage,
})

function QuestionsPage() {
  const questions = Route.useLoaderData()
  const save = useServerFn(saveQuestion)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-4xl tracking-tight">Questions</h1>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const prompt = String(new FormData(event.currentTarget).get('prompt') ?? '')
          void save({ data: { prompt } }).then(async (result) => {
            setNotice(result.ok ? 'Added.' : result.error)
            if (result.ok) {
              event.currentTarget.reset()
              await router.invalidate()
            }
          })
        }}
      >
        <label className="field">
          Question
          <input name="prompt" required />
        </label>
        <button type="submit" className="min-h-11 w-fit rounded-full bg-ink px-5 text-sm text-ivory">
          Add the question
        </button>
      </form>
      {notice ? <p className="text-sm">{notice}</p> : null}
      <ul className="grid gap-3">
        {questions.map((question) => (
          <li key={question.id} className="rounded-2xl border border-line bg-ivory px-4 py-3">
            {question.prompt}
          </li>
        ))}
      </ul>
    </div>
  )
}

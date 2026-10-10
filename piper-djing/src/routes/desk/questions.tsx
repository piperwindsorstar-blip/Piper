import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { DeskTitle, deskCard, deskPrimary } from '../../components/desk-ui.tsx'
import { getQuestions, saveQuestion } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/questions')({
  head: () => deskHead('Questions · Piper DJing'),
  loader: () => getQuestions(),
  component: QuestionsPage,
})

function QuestionsPage() {
  const questions = Route.useLoaderData()
  const save = useServerFn(saveQuestion)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Questions" title="Questions" />
      <form
        className={`${deskCard} grid gap-3`}
        onSubmit={(event) => {
          event.preventDefault()
          const prompt = String(
            new FormData(event.currentTarget).get('prompt') ?? '',
          )
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
        <button type="submit" className={`${deskPrimary} w-fit`}>
          Add the question
        </button>
      </form>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
      <ul className="grid gap-2">
        {questions.map((question) => (
          <li
            key={question.id}
            className="rounded-xl border border-white/10 bg-ink-900 px-4 py-3 font-semibold"
          >
            {question.prompt}
          </li>
        ))}
      </ul>
    </div>
  )
}

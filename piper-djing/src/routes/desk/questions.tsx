import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskDanger,
  deskPrimary,
} from '../../components/desk-ui.tsx'
import {
  deleteQuestion,
  editQuestion,
  getQuestions,
  saveQuestion,
} from '../../lib/crm/desk.functions.ts'
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
          const form = event.currentTarget
          const prompt = String(new FormData(form).get('prompt') ?? '')
          void save({ data: { prompt } }).then(async (result) => {
            setNotice(result.ok ? 'Added.' : result.error)
            if (result.ok) {
              form.reset()
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
          <QuestionCard key={question.id} question={question} />
        ))}
      </ul>
    </div>
  )
}

function QuestionCard({
  question,
}: {
  question: { id: number; prompt: string }
}) {
  const save = useServerFn(editQuestion)
  const remove = useServerFn(deleteQuestion)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <li className="rounded-xl border border-white/10 bg-ink-900 px-4 py-3">
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const prompt = String(
            new FormData(event.currentTarget).get('prompt') ?? '',
          )
          void save({ data: { id: question.id, prompt } }).then(
            async (result) => {
              setNotice(result.ok ? 'Saved.' : result.error)
              if (result.ok) await router.invalidate()
            },
          )
        }}
      >
        <label className="field">
          Question
          <input name="prompt" required defaultValue={question.prompt} />
        </label>
        <div className="flex flex-wrap gap-3">
          <button type="submit" className={deskPrimary}>
            Save
          </button>
          <button
            type="button"
            className={deskDanger}
            onClick={() => {
              void remove({ data: { id: question.id } }).then(
                async (result) => {
                  setNotice(result.ok ? 'Deleted.' : result.error)
                  if (result.ok) await router.invalidate()
                },
              )
            }}
          >
            Delete
          </button>
        </div>
      </form>
      {notice ? <p className="mt-3 text-sm text-white/85">{notice}</p> : null}
    </li>
  )
}

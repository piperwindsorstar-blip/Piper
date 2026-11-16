import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskDanger,
  deskPrimary,
  deskSurface,
  ConfirmDelete,
} from '../../components/desk-ui.tsx'
import {
  deleteQuestion,
  editQuestion,
  getQuestions,
  saveQuestion,
} from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'

export const Route = createFileRoute('/desk/questions')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Questions · DJ Piper P'),
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
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="field">
          Question
          <input name="prompt" required />
        </label>
        <ActionButton
          className={`${deskPrimary} w-fit`}
          checkForm
          busy="Saving…"
          done="Saved"
          surface={deskSurface}
          onRun={async (
            form: FormData,
            formElement: HTMLFormElement | null,
          ): Promise<RunResult | undefined> => {
            const prompt = String(form.get('prompt') ?? '')
            const result = await save({ data: { prompt } })
            setNotice(result.ok ? 'Added.' : result.error)
            if (result.ok) {
              formElement?.reset()
              await router.invalidate()
            }
            return {
              ok: result.ok,
              message: result.ok ? 'Added.' : result.error,
            }
          }}
        >
          Add the question
        </ActionButton>
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
      <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
        <label className="field">
          Question
          <input name="prompt" required defaultValue={question.prompt} />
        </label>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            className={deskPrimary}
            checkForm
            busy="Saving…"
            done="Saved"
            surface={deskSurface}
            onRun={async (form: FormData): Promise<RunResult | undefined> => {
              const prompt = String(form.get('prompt') ?? '')
              const result = await save({ data: { id: question.id, prompt } })
              setNotice(result.ok ? 'Saved.' : result.error)
              if (result.ok) await router.invalidate()
              return {
                ok: result.ok,
                message: result.ok ? 'Saved.' : result.error,
              }
            }}
          >
            Save
          </ActionButton>
          <ConfirmDelete
                className={deskDanger}
                onConfirm={() => {
              void remove({ data: { id: question.id } }).then(
                async (result) => {
                  setNotice(result.ok ? 'Deleted.' : result.error)
                  if (result.ok) await router.invalidate()
                },
              )
            }}
              >
                Delete
              </ConfirmDelete>
        </div>
      </form>
      {notice ? <p className="mt-3 text-sm text-white/85">{notice}</p> : null}
    </li>
  )
}

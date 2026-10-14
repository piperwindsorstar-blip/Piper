import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  ShowSwitch,
  deskCard,
  deskPrimary,
  deskSurface,
  ConfirmDelete,
  deskDanger,
} from '../../components/desk-ui.tsx'
import {
  deleteReview,
  editReview,
  getReviews,
  saveReview,
  showReview,
} from '../../lib/crm/desk.functions.ts'
import { REVIEW_SOURCES, reviewSourceLabel } from '../../lib/crm/reviews.ts'
import type { ReviewDraft, ReviewView } from '../../lib/crm/reviews.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { DeskGoogleReviews } from '../../components/desk-google-reviews.tsx'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'

export const Route = createFileRoute('/desk/reviews')({
  head: () => deskHead('Reviews · DJ Piper P'),
  loader: () => getReviews(),
  component: ReviewsPage,
})

const emptyDraft = {
  quote: '',
  names: '',
  eventType: '',
  town: '',
  date: '',
  source: 'google',
  show: false,
}

function draftFrom(form: HTMLFormElement): ReviewDraft {
  const data = new FormData(form)
  return {
    quote: String(data.get('quote') ?? ''),
    names: String(data.get('names') ?? ''),
    eventType: String(data.get('eventType') ?? ''),
    town: String(data.get('town') ?? ''),
    date: String(data.get('date') ?? ''),
    source: String(data.get('source') ?? ''),
    show: data.get('show') === 'on',
  }
}

function ReviewFields({ review }: { review?: ReviewView }) {
  return (
    <>
      <label className="field">
        Quote
        <textarea
          name="quote"
          required
          rows={4}
          defaultValue={review?.quote ?? ''}
        />
      </label>
      <label className="field">
        Couple or client name
        <input name="names" defaultValue={review?.names ?? ''} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Event type
          <input name="eventType" defaultValue={review?.eventType ?? ''} />
        </label>
        <label className="field">
          Town
          <input name="town" defaultValue={review?.town ?? ''} />
        </label>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Date
          <input
            name="date"
            type="date"
            required
            defaultValue={review?.date ?? ''}
          />
        </label>
        <label className="field">
          Source
          <select
            name="source"
            defaultValue={review?.source ?? emptyDraft.source}
          >
            {REVIEW_SOURCES.map((source) => (
              <option key={source} value={source}>
                {reviewSourceLabel(source)}
              </option>
            ))}
          </select>
        </label>
      </div>
    </>
  )
}

function SavedReview({ review }: { review: ReviewView }) {
  const save = useServerFn(editReview)
  const toggle = useServerFn(showReview)
  const remove = useServerFn(deleteReview)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const [shown, setShown] = useState(review.show)

  return (
    <li className="grid gap-3 rounded-2xl border border-white/10 bg-ink-900 p-5">
      <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
        <ReviewFields review={review} />
        <ShowSwitch
          checked={shown}
          onChange={(show) => {
            setShown(show)
            void toggle({ data: { id: review.id, show } }).then(
              async (result) => {
                if (!result.ok) {
                  setShown(!show)
                  setNotice(result.error)
                  return
                }
                setShown(result.review.show)
                setNotice(
                  result.review.show
                    ? 'This review is on the site.'
                    : 'This review is hidden.',
                )
                await router.invalidate()
              },
            )
          }}
        />
        <div className="flex flex-wrap gap-3">
          <ActionButton
            className={deskPrimary}
            checkForm
            busy="Saving…"
            done="Saved"
            surface={deskSurface}
            onRun={async (
              _form: FormData,
              formElement: HTMLFormElement | null,
            ): Promise<RunResult | undefined> => {
              if (!formElement) return { ok: false, message: 'Try again.' }
              const result = await save({
                data: { id: review.id, ...draftFrom(formElement) },
              })
              setNotice(result.ok ? 'Review saved.' : result.error)
              if (result.ok) {
                setShown(result.review.show)
                await router.invalidate()
              }
              return {
                ok: result.ok,
                message: result.ok ? 'Review saved.' : result.error,
              }
            }}
          >
            Save
          </ActionButton>
          <ConfirmDelete
                className={deskDanger}
                onConfirm={() => {
              void remove({ data: { id: review.id } }).then(async (result) => {
                setNotice(result.ok ? 'Review deleted.' : result.error)
                if (result.ok) await router.invalidate()
              })
            }}
              >
                Delete
              </ConfirmDelete>
        </div>
      </form>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
    </li>
  )
}

function ReviewsPage() {
  const reviews = Route.useLoaderData()
  const add = useServerFn(saveReview)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)
  const [show, setShow] = useState(false)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Reviews" title="Reviews">
        <p className="mt-1 text-sm text-white/65">
          Reviews switched on appear on the home page and the weddings page,
          newest first. Nothing is shown until you switch it on.
        </p>
      </DeskTitle>
      <DeskGoogleReviews />
      <form
        className={`${deskCard} grid gap-3`}
        onSubmit={(event) => event.preventDefault()}
      >
        <h2 className="font-display text-xl font-bold">Add a review</h2>
        <ReviewFields />
        <ShowSwitch checked={show} onChange={setShow} />
        <ActionButton
          className={`${deskPrimary} w-fit`}
          checkForm
          busy="Saving…"
          done="Saved"
          surface={deskSurface}
          onRun={async (
            _form: FormData,
            formElement: HTMLFormElement | null,
          ): Promise<RunResult | undefined> => {
            if (!formElement) return { ok: false, message: 'Try again.' }
            const result = await add({ data: draftFrom(formElement) })
            setNotice(result.ok ? 'Review added.' : result.error)
            if (result.ok) {
              formElement.reset()
              setShow(false)
              await router.invalidate()
            }
            return {
              ok: result.ok,
              message: result.ok ? 'Review added.' : result.error,
            }
          }}
        >
          Add the review
        </ActionButton>
      </form>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
      {reviews.length === 0 ? (
        <p className="text-sm text-white/65">No reviews yet.</p>
      ) : (
        <ul className="grid gap-3">
          {reviews.map((review) => (
            <SavedReview key={review.id} review={review} />
          ))}
        </ul>
      )}
    </div>
  )
}

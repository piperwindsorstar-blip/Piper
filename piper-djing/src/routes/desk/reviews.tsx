import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  deleteReview,
  editReview,
  getReviews,
  saveReview,
  showReview,
} from '../../lib/crm/desk.functions.ts'
import { REVIEW_SOURCES, reviewSourceLabel } from '../../lib/crm/reviews.ts'
import type { ReviewDraft, ReviewView } from '../../lib/crm/reviews.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/reviews')({
  head: () => privateHead('Reviews · Piper DJing'),
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
    <li className="grid gap-3 rounded-card border border-line bg-ivory px-4 py-4">
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const draft = draftFrom(event.currentTarget)
          void save({ data: { id: review.id, ...draft } }).then(
            async (result) => {
              setNotice(result.ok ? 'Review saved.' : result.error)
              if (result.ok) {
                setShown(result.review.show)
                await router.invalidate()
              }
            },
          )
        }}
      >
        <ReviewFields review={review} />
        <label className="flex items-center gap-3 text-sm">
          <input
            name="show"
            type="checkbox"
            className="size-5"
            checked={shown}
            onChange={(event) => {
              const show = event.target.checked
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
          Show on site
        </label>
        <div className="flex flex-wrap gap-3">
          <button
            type="submit"
            className="min-h-11 rounded-full bg-ink px-5 text-sm text-ivory"
          >
            Save
          </button>
          <button
            type="button"
            className="min-h-11 text-sm text-danger"
            onClick={() => {
              void remove({ data: { id: review.id } }).then(async (result) => {
                setNotice(result.ok ? 'Review deleted.' : result.error)
                if (result.ok) await router.invalidate()
              })
            }}
          >
            Delete
          </button>
        </div>
      </form>
      {notice ? <p className="text-sm">{notice}</p> : null}
    </li>
  )
}

function ReviewsPage() {
  const reviews = Route.useLoaderData()
  const add = useServerFn(saveReview)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid max-w-2xl gap-6">
      <div>
        <h1 className="font-display text-4xl tracking-tight">Reviews</h1>
        <p className="mt-3 text-sm text-ink-soft">
          Reviews switched on appear on the home page and the weddings page,
          newest first. Nothing is shown until you switch it on.
        </p>
      </div>
      <form
        className="grid gap-3 rounded-card border border-line bg-ivory px-4 py-4"
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          void add({ data: draftFrom(form) }).then(async (result) => {
            setNotice(result.ok ? 'Review added.' : result.error)
            if (result.ok) {
              form.reset()
              await router.invalidate()
            }
          })
        }}
      >
        <h2 className="font-display text-2xl">Add a review</h2>
        <ReviewFields />
        <label className="flex items-center gap-3 text-sm">
          <input name="show" type="checkbox" className="size-5" />
          Show on site
        </label>
        <button
          type="submit"
          className="min-h-11 w-fit rounded-full bg-ink px-5 text-sm text-ivory"
        >
          Add the review
        </button>
      </form>
      {notice ? <p className="text-sm">{notice}</p> : null}
      {reviews.length === 0 ? (
        <p className="text-sm text-muted">No reviews yet.</p>
      ) : (
        <ul className="grid gap-4">
          {reviews.map((review) => (
            <SavedReview key={review.id} review={review} />
          ))}
        </ul>
      )}
    </div>
  )
}

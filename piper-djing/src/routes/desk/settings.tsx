import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  deleteReview,
  getSettings,
  saveKindWords,
  saveReview,
} from '../../lib/crm/desk.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/settings')({
  head: () => privateHead('Settings · Piper DJing'),
  loader: () => getSettings(),
  component: SettingsPage,
})

function SettingsPage() {
  const settings = Route.useLoaderData()
  const save = useServerFn(saveKindWords)
  const add = useServerFn(saveReview)
  const remove = useServerFn(deleteReview)
  const router = useRouter()
  const [kindWords, setKindWords] = useState(settings.kindWords)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid max-w-prose gap-4">
      <h1 className="font-display text-4xl tracking-tight">Settings</h1>
      <label className="flex items-center gap-3 rounded-card border border-line bg-ivory px-4 py-4 text-sm">
        <input
          type="checkbox"
          className="size-5"
          checked={kindWords}
          onChange={(event) => {
            const on = event.target.checked
            setKindWords(on)
            void save({ data: { on } }).then(async (result) => {
              if (!result.ok) {
                setKindWords(!on)
                setNotice(result.error)
                return
              }
              setKindWords(result.on)
              setNotice(
                result.on
                  ? 'Kind words are on the homepage.'
                  : 'Kind words are off the homepage.',
              )
              await router.invalidate()
            })
          }}
        />
        Show Kind Words on the homepage
      </label>
      <section className="grid gap-3">
        <h2 className="font-display text-2xl">Reviews</h2>
        <p className="text-sm text-ink-soft">
          Add the words people have given you. They appear in Kind Words only
          while that section is on.
        </p>
        <form
          className="grid gap-3"
          onSubmit={(event) => {
            event.preventDefault()
            const form = event.currentTarget
            const data = new FormData(form)
            void add({
              data: {
                quote: String(data.get('quote') ?? ''),
                names: String(data.get('names') ?? ''),
                when: String(data.get('when') ?? ''),
              },
            }).then(async (result) => {
              setNotice(result.ok ? 'Review added.' : result.error)
              if (result.ok) {
                form.reset()
                await router.invalidate()
              }
            })
          }}
        >
          <label className="field">
            Their words
            <textarea name="quote" required rows={4} />
          </label>
          <label className="field">
            Names
            <input name="names" required />
          </label>
          <label className="field">
            When or where
            <input name="when" placeholder="June 2026" />
          </label>
          <button
            type="submit"
            className="min-h-11 w-fit rounded-full bg-ink px-5 text-sm text-ivory"
          >
            Add the review
          </button>
        </form>
        {settings.reviews.length === 0 ? (
          <p className="text-sm text-muted">No reviews yet.</p>
        ) : (
          <ul className="grid gap-3">
            {settings.reviews.map((review) => (
              <li
                key={review.id}
                className="rounded-card border border-line bg-ivory px-4 py-4"
              >
                <blockquote className="whitespace-pre-wrap text-sm">
                  “{review.quote}”
                </blockquote>
                <p className="mt-3 text-sm text-muted">
                  {review.names}
                  {review.when ? ` · ${review.when}` : ''}
                </p>
                <button
                  type="button"
                  className="mt-3 min-h-11 text-sm text-danger"
                  onClick={() => {
                    void remove({ data: { id: review.id } }).then(
                      async (result) => {
                        setNotice(result.ok ? 'Review removed.' : result.error)
                        if (result.ok) await router.invalidate()
                      },
                    )
                  }}
                >
                  Remove
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>
      {notice ? <p className="text-sm">{notice}</p> : null}
      <p>Desk owner: {settings.email}</p>
      <p>Home base for travel: {settings.homeBase}</p>
      <p className="text-sm text-ink-soft">
        Travel is calculated from kilometres. The first 20 kilometres are
        included, then each further kilometre is added. Two venues is the
        maximum. There is no flat travel fee to type in.
      </p>
      <p>
        {settings.mailReady
          ? `Email uses the PiperPWeddingDJ@gmail.com inbox. Messages go out as ${settings.mailFrom}.`
          : `Email uses the PiperPWeddingDJ@gmail.com inbox. Messages are written as ${settings.mailFrom}. They are not sent until that inbox has its Gmail app password.`}
      </p>
      {settings.localBook ? (
        <p className="text-sm text-muted">
          This desk is using the local book. It clears when the server reloads.
          The published book is left alone.
        </p>
      ) : null}
      <h2 className="mt-4 font-display text-2xl">Emails</h2>
      {settings.emails.length === 0 ? (
        <p className="text-sm text-muted">No emails yet.</p>
      ) : (
        <ul className="grid gap-3 text-sm">
          {settings.emails.map((email) => (
            <li
              key={email.id}
              className="rounded-card border border-line bg-ivory px-4 py-3"
            >
              <p>
                {email.kind === 'invoice' ? 'Invoice' : 'Booking'} · {email.to}
              </p>
              <p className="text-muted">{email.subject}</p>
              <p>{email.delivered ? 'Sent.' : email.detail}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

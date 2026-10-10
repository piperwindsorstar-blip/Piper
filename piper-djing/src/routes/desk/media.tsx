import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { DeskTitle, deskCard, deskPrimary } from '../../components/desk-ui.tsx'
import { getMedia, saveMedia } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/media')({
  head: () => deskHead('Media · Piper DJing'),
  loader: () => getMedia(),
  component: MediaPage,
})

function MediaPage() {
  const media = Route.useLoaderData()
  const save = useServerFn(saveMedia)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Media" title="Media" />
      <form
        className={`${deskCard} grid gap-3`}
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void save({
            data: {
              title: String(form.get('title') ?? ''),
              url: String(form.get('url') ?? ''),
            },
          }).then(async (result) => {
            setNotice(result.ok ? 'Added.' : result.error)
            if (result.ok) {
              event.currentTarget.reset()
              await router.invalidate()
            }
          })
        }}
      >
        <label className="field">
          Title
          <input name="title" required />
        </label>
        <label className="field">
          Link
          <input name="url" required placeholder="https://" />
        </label>
        <button type="submit" className={`${deskPrimary} w-fit`}>
          Add the link
        </button>
      </form>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
      <ul className="grid gap-2">
        {media.map((item) => (
          <li
            key={item.id}
            className="rounded-xl border border-white/10 bg-ink-900 px-4 py-3"
          >
            <a
              href={item.url}
              className="font-semibold text-hot underline"
              target="_blank"
              rel="noopener noreferrer"
            >
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

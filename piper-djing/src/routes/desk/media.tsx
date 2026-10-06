import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getMedia, saveMedia } from '../../lib/crm/desk.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/media')({
  head: () => privateHead('Media · Piper DJing'),
  loader: () => getMedia(),
  component: MediaPage,
})

function MediaPage() {
  const media = Route.useLoaderData()
  const save = useServerFn(saveMedia)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-6">
      <h1 className="font-display text-4xl tracking-tight">Media</h1>
      <form
        className="grid gap-3"
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void save({
            data: { title: String(form.get('title') ?? ''), url: String(form.get('url') ?? '') },
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
        <button type="submit" className="min-h-11 w-fit rounded-full bg-ink px-5 text-sm text-ivory">
          Add the link
        </button>
      </form>
      {notice ? <p className="text-sm">{notice}</p> : null}
      <ul className="grid gap-3">
        {media.map((item) => (
          <li key={item.id}>
            <a href={item.url} className="text-ink underline" target="_blank" rel="noopener noreferrer">
              {item.title}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

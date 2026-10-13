import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskDanger,
  deskPrimary,
  deskSurface,
} from '../../components/desk-ui.tsx'
import {
  deleteMedia,
  editMedia,
  getMedia,
  saveMedia,
} from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'

export const Route = createFileRoute('/desk/media')({
  head: () => deskHead('Media · DJ Piper P'),
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
        onSubmit={(event) => event.preventDefault()}
      >
        <label className="field">
          Title
          <input name="title" required />
        </label>
        <label className="field">
          Link
          <input name="url" required placeholder="https://" />
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
            const data = form
            const result = await save({
              data: {
                title: String(data.get('title') ?? ''),
                url: String(data.get('url') ?? ''),
              },
            })
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
          Add the link
        </ActionButton>
      </form>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
      <ul className="grid gap-2">
        {media.map((item) => (
          <MediaCard key={item.id} item={item} />
        ))}
      </ul>
    </div>
  )
}

function MediaCard({
  item,
}: {
  item: { id: number; title: string; url: string }
}) {
  const save = useServerFn(editMedia)
  const remove = useServerFn(deleteMedia)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <li className="rounded-xl border border-white/10 bg-ink-900 px-4 py-3">
      <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
        <label className="field">
          Title
          <input name="title" required defaultValue={item.title} />
        </label>
        <label className="field">
          Link
          <input name="url" required defaultValue={item.url} />
        </label>
        <a
          href={item.url}
          className="text-sm font-semibold text-hot underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          Open the link
        </a>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            className={deskPrimary}
            checkForm
            busy="Saving…"
            done="Saved"
            surface={deskSurface}
            onRun={async (form: FormData): Promise<RunResult | undefined> => {
              const result = await save({
                data: {
                  id: item.id,
                  title: String(form.get('title') ?? ''),
                  url: String(form.get('url') ?? ''),
                },
              })
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
          <button
            type="button"
            className={deskDanger}
            onClick={() => {
              void remove({ data: { id: item.id } }).then(async (result) => {
                setNotice(result.ok ? 'Deleted.' : result.error)
                if (result.ok) await router.invalidate()
              })
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

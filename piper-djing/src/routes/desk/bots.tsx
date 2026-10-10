import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  Chip,
  DeskTitle,
  deskCard,
  deskPrimary,
} from '../../components/desk-ui.tsx'
import { getBots, saveBot } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/bots')({
  head: () => deskHead('Bots · Piper DJing'),
  loader: () => getBots(),
  component: BotsPage,
})

function BotsPage() {
  const bots = Route.useLoaderData()
  const save = useServerFn(saveBot)
  const router = useRouter()
  const [token, setToken] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Bots" title="Bots">
        <p className="mt-1 max-w-prose text-sm text-white/65">
          Every bot can read. A writer or the Ceo bot can change the book, send
          mail, and edit the one terms document. The token is shown once.
        </p>
      </DeskTitle>
      <form
        className={`${deskCard} grid gap-3 sm:grid-cols-2`}
        onSubmit={(event) => {
          event.preventDefault()
          const form = new FormData(event.currentTarget)
          void save({
            data: {
              name: String(form.get('name') ?? ''),
              role: String(form.get('role') ?? ''),
            },
          }).then(async (result) => {
            if (!result.ok) {
              setError(result.error)
              setToken(null)
              return
            }
            setError(null)
            setToken(result.token)
            event.currentTarget.reset()
            await router.invalidate()
          })
        }}
      >
        <label className="field">
          Name
          <input name="name" required />
        </label>
        <label className="field">
          Role
          <select name="role" defaultValue="reader">
            <option value="reader">Reader</option>
            <option value="writer">Writer</option>
            <option value="ceo">Ceo</option>
          </select>
        </label>
        <button type="submit" className={`${deskPrimary} w-fit`}>
          Invite
        </button>
        {token ? (
          <div className="rounded-xl border border-neon/40 bg-neon/10 p-4 sm:col-span-2">
            <p className="text-sm">
              Token, copy it now:{' '}
              <span className="font-mono break-all">{token}</span>
            </p>
            <button
              type="button"
              className="mt-2 text-sm font-semibold text-hot hover:underline"
              onClick={() => setToken(null)}
            >
              I copied it
            </button>
          </div>
        ) : null}
      </form>
      {error ? <p className="text-sm text-rose-300">{error}</p> : null}
      <ul className="grid gap-2">
        {bots.map((bot) => (
          <li
            key={bot.id}
            className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-ink-900 px-4 py-3 text-sm"
          >
            <span className="font-semibold">{bot.name}</span>
            <Chip
              tone={
                bot.role === 'ceo'
                  ? 'pink'
                  : bot.role === 'writer'
                    ? 'amber'
                    : 'gray'
              }
            >
              {bot.role === 'ceo' ? 'Ceo' : bot.role}
            </Chip>
          </li>
        ))}
      </ul>
    </div>
  )
}

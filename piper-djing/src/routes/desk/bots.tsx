import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { getBots, saveBot } from '../../lib/crm/desk.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/bots')({
  head: () => privateHead('Bots · Piper DJing'),
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
    <div className="grid gap-6">
      <h1 className="font-display text-4xl tracking-tight">Bots</h1>
      <p className="max-w-prose text-sm text-muted">
        Every bot can read. A writer or the Ceo bot can change the book, send
        mail, and edit the one terms document. The token is shown once.
      </p>
      <form
        className="grid gap-3 sm:grid-cols-2"
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
        <button
          type="submit"
          className="min-h-11 w-fit rounded-full bg-ink px-5 text-sm text-ivory"
        >
          Invite
        </button>
      </form>
      {error ? <p className="text-sm text-danger">{error}</p> : null}
      {token ? (
        <p className="rounded-2xl border border-line bg-ivory px-4 py-3 text-sm">
          Token, copy it now:{' '}
          <span className="break-all font-medium">{token}</span>
        </p>
      ) : null}
      <ul className="grid gap-2">
        {bots.map((bot) => (
          <li key={bot.id} className="text-sm">
            {bot.name} · {bot.role === 'ceo' ? 'Ceo' : bot.role}
          </li>
        ))}
      </ul>
    </div>
  )
}

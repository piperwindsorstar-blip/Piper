import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { deskAuthed, signIn } from '../lib/auth/server.ts'
import { privateHead } from '../lib/seo.ts'

export const Route = createFileRoute('/login')({
  head: () => privateHead('Sign in · Piper DJing'),
  loader: async () => {
    if (await deskAuthed()) {
      const { redirect } = await import('@tanstack/react-router')
      throw redirect({ to: '/desk' })
    }
    return null
  },
  component: LoginPage,
})

function LoginPage() {
  const sign = useServerFn(signIn)
  const router = useRouter()
  const [error, setError] = useState<string | null>(null)

  return (
    <main className="desk flex min-h-screen w-full flex-col items-center justify-center bg-ink-950 px-5 py-16 text-white">
      <div className="w-full max-w-md">
        <img
          src="/brand/dj-piper-p.png"
          alt="DJ Piper P"
          className="mx-auto h-20 w-auto"
        />
        <p className="mt-4 text-center font-mono text-[10px] tracking-[0.22em] text-white/60 uppercase">
          Piper Desk
        </p>
        <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">
          Sign in
        </h1>
        <p className="mt-3 text-sm text-white/65">The desk is for Piper only.</p>
        <form
          className="mt-8 grid gap-4"
        method="post"
        onSubmit={(event) => {
          event.preventDefault()
          const password = String(
            new FormData(event.currentTarget).get('password') ?? '',
          )
          void sign({ data: { password } })
            .then(async (result) => {
              if (!result.ok) {
                setError('That password did not match.')
                return
              }
              await router.navigate({ to: '/desk' })
            })
            .catch(() => {
              setError('The desk did not open. Try again.')
            })
        }}
      >
        <label className="field">
          Password
          <input
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button
          type="submit"
          className="inline-flex min-h-12 items-center justify-center rounded-full bg-neon px-6 text-lg font-bold text-white shadow-[0_0_20px_rgba(255,0,127,.4)] transition hover:bg-hot"
        >
          Open the desk
        </button>
        </form>
      </div>
    </main>
  )
}

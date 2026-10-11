import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { deskAuthed, signIn } from '../lib/auth/server.ts'
import { privateHead } from '../lib/seo.ts'
import { bigButton } from '../components/site-frame.tsx'

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
    <main className="mx-auto flex min-h-screen w-full max-w-md flex-col justify-center px-5 py-16">
      <h1 className="font-display text-4xl tracking-tight">Sign in</h1>
      <p className="mt-3 text-sm text-muted">The desk is for Piper only.</p>
      <form
        className="mt-8 grid gap-4"
        method="post"
        onSubmit={(event) => {
          event.preventDefault()
          const password = String(new FormData(event.currentTarget).get('password') ?? '')
          void sign({ data: { password } }).then(async (result) => {
            if (!result.ok) {
              setError('That password did not match.')
              return
            }
            await router.navigate({ to: '/desk' })
          })
        }}
      >
        <label className="field">
          Password
          <input name="password" type="password" autoComplete="current-password" required />
        </label>
        {error ? <p className="text-sm text-danger">{error}</p> : null}
        <button type="submit" className={`${bigButton} bg-ink text-ivory`}>
          <span className="font-display text-2xl">Open the desk</span>
        </button>
      </form>
    </main>
  )
}

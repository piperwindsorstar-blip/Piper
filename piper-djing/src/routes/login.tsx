import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  confirmTwoFactorSetup,
  deskAuthed,
  signIn,
  startTwoFactorSetup,
  verifyTwoFactor,
} from '../lib/auth/server.ts'
import { privateHead } from '../lib/seo.ts'

export const Route = createFileRoute('/login')({
  head: () => privateHead('Sign in · DJ Piper P'),
  loader: async () => {
    if (await deskAuthed()) {
      const { redirect } = await import('@tanstack/react-router')
      throw redirect({ to: '/desk' })
    }
    return null
  },
  component: LoginPage,
})

type Stage =
  | { name: 'password' }
  | { name: 'code' }
  | { name: 'enroll'; qrSvg: string; secret: string }
  | { name: 'saved'; codes: string[] }

/** The same words for a wrong password and a wrong code. */
const GENERIC = 'That did not match. Check it and try again.'

function reasonText(reason: string, message?: string): string {
  if (reason === 'locked') return 'Too many tries. Wait 15 minutes and try again.'
  if (reason === 'expired') return 'That took too long. Enter your password again.'
  if (reason === 'unset') {
    return 'The desk password is not set. Add DESK_PASSWORD as a Secret in Cloudflare (piper-djing → Settings → Variables and Secrets).'
  }
  if (reason === 'unavailable') {
    return message ?? 'Two-step sign-in is not ready: the DESK_2FA_KEY secret is missing on the Worker.'
  }
  return GENERIC
}

const button =
  'inline-flex min-h-12 items-center justify-center rounded-full bg-neon px-6 text-lg font-bold text-white shadow-[0_0_20px_rgba(255,0,127,.4)] transition hover:bg-hot disabled:opacity-50'

function TrustBox() {
  return (
    <label className="flex items-start gap-3 text-sm text-white/80">
      <input name="trust" type="checkbox" className="mt-1 h-4 w-4" />
      Trust this device for 30 days (no code needed here until then). Leave it off on shared computers.
    </label>
  )
}

function LoginPage() {
  const sign = useServerFn(signIn)
  const setup = useServerFn(startTwoFactorSetup)
  const confirm = useServerFn(confirmTwoFactorSetup)
  const verify = useServerFn(verifyTwoFactor)
  const router = useRouter()
  const [stage, setStage] = useState<Stage>({ name: 'password' })
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  const fail = (reason: string, message?: string) => {
    setError(reasonText(reason, message))
    if (reason === 'expired') setStage({ name: 'password' })
  }

  const run = (work: () => Promise<void>) => {
    if (busy) return
    setBusy(true)
    setError(null)
    void work()
      .catch(() => setError('The desk did not open. Try again.'))
      .finally(() => setBusy(false))
  }

  return (
    <main className="desk flex min-h-screen w-full flex-col items-center justify-center bg-paper px-5 py-16 text-ink">
      <div className="login-card w-full max-w-md rounded-2xl border border-ink bg-ink/95 p-7 text-white shadow-[8px_8px_0_0_#EEE8FF]">
        <img src="/brand/dj-piper-p.png" alt="DJ Piper P" className="mx-auto h-20 w-auto" />
        <p className="mt-4 text-center font-mono text-[10px] tracking-[0.22em] text-white/60 uppercase">
          Piper Desk
        </p>

        {stage.name === 'password' ? (
          <>
            <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">Sign in</h1>
            <p className="mt-3 text-sm text-white/65">The desk is for Piper only.</p>
            <form
              className="mt-8 grid gap-4"
              method="post"
              onSubmit={(event) => {
                event.preventDefault()
                const password = String(new FormData(event.currentTarget).get('password') ?? '')
                run(async () => {
                  const result = await sign({ data: { password } })
                  if (result.reason === 'ok') {
                    await router.navigate({ to: '/desk' })
                    return
                  }
                  if (result.reason === 'code') {
                    setStage({ name: 'code' })
                    return
                  }
                  if (result.reason === 'enroll') {
                    const started = await setup({ data: {} })
                    if (!started.ok) {
                      fail(started.reason)
                      return
                    }
                    setStage({ name: 'enroll', qrSvg: started.qrSvg, secret: started.secret })
                    return
                  }
                  fail(result.reason)
                })
              }}
            >
              <label className="field">
                Password
                <input name="password" type="password" autoComplete="current-password" required />
              </label>
              {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
              <button type="submit" className={button} disabled={busy}>
                Continue
              </button>
            </form>
          </>
        ) : null}

        {stage.name === 'code' ? (
          <>
            <h1 className="mt-6 font-display text-4xl font-extrabold tracking-tight">Your code</h1>
            <p className="mt-3 text-sm text-white/65">
              Open your authenticator app and enter the 6-digit code for DJ Piper P. Lost your phone? Enter one of your
              backup codes instead.
            </p>
            <form
              className="mt-8 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                const code = String(form.get('code') ?? '')
                const trust = form.get('trust') === 'on'
                run(async () => {
                  const result = await verify({ data: { code, trust } })
                  if (result.ok) {
                    await router.navigate({ to: '/desk' })
                    return
                  }
                  fail(result.reason, 'message' in result ? result.message : undefined)
                })
              }}
            >
              <label className="field">
                Code
                <input
                  name="code"
                  autoComplete="one-time-code"
                  inputMode="text"
                  autoCapitalize="none"
                  spellCheck={false}
                  placeholder="123456"
                  required
                  autoFocus
                />
              </label>
              <TrustBox />
              {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
              <button type="submit" className={button} disabled={busy}>
                Open the desk
              </button>
            </form>
          </>
        ) : null}

        {stage.name === 'enroll' ? (
          <>
            <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">Set up two-step sign-in</h1>
            <ol className="mt-4 grid list-decimal gap-2 pl-5 text-sm text-white/80">
              <li>Open an authenticator app on your phone (Google Authenticator, Authy, Microsoft Authenticator…).</li>
              <li>Add an account and scan this QR code, or type the key below.</li>
              <li>Enter the 6-digit code the app shows to turn it on.</li>
            </ol>
            <div
              className="mx-auto mt-5 w-56 rounded-xl bg-white p-2 [&_svg]:h-auto [&_svg]:w-full"
              aria-label="QR code for your authenticator app"
              role="img"
              dangerouslySetInnerHTML={{ __html: stage.qrSvg }}
            />
            <p className="mt-4 text-center text-xs text-white/60">Or type this key</p>
            <p className="mt-1 text-center font-mono text-base tracking-wider break-all select-all" data-2fa-secret>
              {stage.secret}
            </p>
            <p className="mt-2 text-center text-xs text-white/60">Shown only now. It never appears again.</p>
            <form
              className="mt-6 grid gap-4"
              onSubmit={(event) => {
                event.preventDefault()
                const form = new FormData(event.currentTarget)
                const code = String(form.get('code') ?? '')
                const trust = form.get('trust') === 'on'
                run(async () => {
                  const result = await confirm({ data: { code, trust } })
                  if (result.ok) {
                    setStage({ name: 'saved', codes: result.backupCodes ?? [] })
                    return
                  }
                  fail(result.reason, 'message' in result ? result.message : undefined)
                })
              }}
            >
              <label className="field">
                6-digit code from the app
                <input name="code" inputMode="numeric" autoComplete="one-time-code" placeholder="123456" required />
              </label>
              <TrustBox />
              {error ? <p className="text-sm text-danger" role="alert">{error}</p> : null}
              <button type="submit" className={button} disabled={busy}>
                Turn it on
              </button>
            </form>
          </>
        ) : null}

        {stage.name === 'saved' ? (
          <>
            <h1 className="mt-6 font-display text-3xl font-extrabold tracking-tight">Save your backup codes</h1>
            <p className="mt-3 text-sm text-white/80">
              Two-step sign-in is on. If you lose your phone, each of these codes signs you in once. Store them
              somewhere safe (a password manager or printed). They are shown only now and cannot be shown again.
            </p>
            <ul className="mt-5 grid grid-cols-2 gap-2 rounded-xl bg-white p-4 font-mono text-lg text-ink" data-2fa-backup>
              {stage.codes.map((code) => (
                <li key={code}>{code}</li>
              ))}
            </ul>
            <button
              type="button"
              className="mt-3 min-h-11 text-sm font-semibold text-white/80 underline"
              onClick={() => void navigator.clipboard?.writeText(stage.codes.join('\n'))}
            >
              Copy the codes
            </button>
            <button type="button" className={`${button} mt-6 w-full`} onClick={() => void router.navigate({ to: '/desk' })}>
              I saved them. Open the desk
            </button>
          </>
        ) : null}
      </div>
    </main>
  )
}

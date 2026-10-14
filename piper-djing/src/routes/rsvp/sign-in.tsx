import { createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  Field,
  RsvpFrame,
  RsvpHeader,
  rsvpButton,
  rsvpField,
} from '../../components/rsvp/shell.tsx'
import { rsvpHead } from '../../lib/rsvp/head.ts'
import { requestRsvpSignIn } from '../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/sign-in')({
  head: () => rsvpHead('Couple sign in · DJ Piper P'),
  component: SignIn,
})

function SignIn() {
  const send = useServerFn(requestRsvpSignIn)
  const [email, setEmail] = useState('')
  const [notice, setNotice] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <RsvpFrame>
      <RsvpHeader />
      <h1 className="portal-display text-4xl">Couple sign in</h1>
      <p className="mt-2 text-[var(--text-muted)]">
        We&apos;ll email you a one-time sign-in link. No password to remember.
        $20 with a Piper DJing booking (deposit paid), $30 on its own, plus 13% HST by card.
      </p>
      <form
        className="mt-6 grid gap-4"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          void send({ data: { email } }).then((result) => {
            setBusy(false)
            if (!result.ok) {
              setError(result.error)
              return
            }
            setNotice('If that email has an RSVP, a link is on the way.')
          })
        }}
      >
        <Field id="sign-email" label="Email" error={error}>
          <input
            id="sign-email"
            type="email"
            autoComplete="email"
            className={rsvpField}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? 'sign-email-error' : undefined}
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </Field>
        <button className={rsvpButton} type="submit" disabled={busy}>
          Email me a sign-in link
        </button>
      </form>
      {notice ? (
        <p className="mt-4 text-sm text-[var(--text-muted)]">{notice}</p>
      ) : null}
    </RsvpFrame>
  )
}

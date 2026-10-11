import { Link, useRouter, createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { priceLabel } from '../../lib/rsvp/model.ts'
import { rsvpHead } from '../../lib/rsvp/head.ts'
import { startRsvp } from '../../lib/rsvp/rsvp.functions.ts'
import { Field, rsvpButton, rsvpField } from '../../components/rsvp/shell.tsx'

export const Route = createFileRoute('/rsvp/')({
  head: () => rsvpHead('Wedding RSVP · DJ Piper P', true),
  component: RsvpProduct,
})

function RsvpProduct() {
  const start = useServerFn(startRsvp)
  const router = useRouter()
  const [partnerOne, setOne] = useState('')
  const [partnerTwo, setTwo] = useState('')
  const [email, setEmail] = useState('')
  const [eventDate, setDate] = useState('')
  const [venue, setVenue] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <main
      className="portal grid min-h-screen lg:grid-cols-2"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at left, #2A1220 0%, #0D0D0D 55%)',
      }}
    >
      <section className="flex flex-col justify-between px-6 py-8 lg:px-12">
        <div className="flex items-center gap-2 text-sm font-semibold">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--pink)] font-bold text-[#0D0D0D]">
            P
          </span>
          Piper P · RSVP
        </div>
        <div>
          <h1 className="portal-display text-5xl lg:text-6xl">
            Your wedding RSVP, handled.
          </h1>
          <p className="mt-4 max-w-md text-[var(--text-muted)]">
            Guest list, meals, and song requests. The link starts with RSVP.
          </p>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <article className="rounded-3xl border border-[var(--pink)] p-4">
              <p className="text-3xl font-semibold">{priceLabel(2000)}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                With a paid Piper date
              </p>
            </article>
            <article className="rounded-3xl border border-[var(--border)] p-4">
              <p className="text-3xl font-semibold">{priceLabel(3000)}</p>
              <p className="mt-1 text-sm text-[var(--text-muted)]">
                On its own
              </p>
            </article>
          </div>
        </div>
        <p className="text-sm text-[var(--text-faint)]">
          Brantford, Ontario · piperpweddingdj.services
        </p>
      </section>
      <section className="flex items-center px-6 py-10 lg:px-12">
        <form
          className="grid w-full max-w-md gap-4"
          onSubmit={(event) => {
            event.preventDefault()
            setBusy(true)
            setError('')
            void start({
              data: { partnerOne, partnerTwo, email, eventDate, venue },
            }).then(async (result) => {
              if (!result.ok) {
                setError(result.error)
                setBusy(false)
                return
              }
              await router.navigate({ to: '/rsvp/manage' })
            })
          }}
        >
          <h2 className="portal-display text-3xl">Start an RSVP</h2>
          <p className="text-sm text-[var(--text-muted)]">
            A paid Piper couple is $20. Anyone else is $30. Piper turns the
            guest link on when the payment is recorded.
          </p>
          <Field id="one" label="First partner">
            <input
              id="one"
              className={rsvpField}
              value={partnerOne}
              onChange={(event) => setOne(event.target.value)}
            />
          </Field>
          <Field id="two" label="Second partner">
            <input
              id="two"
              className={rsvpField}
              value={partnerTwo}
              onChange={(event) => setTwo(event.target.value)}
            />
          </Field>
          <Field id="email" label="Email" error={error}>
            <input
              id="email"
              type="email"
              autoComplete="email"
              className={rsvpField}
              aria-invalid={error ? true : undefined}
              aria-describedby={error ? 'email-error' : undefined}
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </Field>
          <Field id="date" label="Wedding date">
            <input
              id="date"
              type="date"
              className={rsvpField}
              value={eventDate}
              onChange={(event) => setDate(event.target.value)}
            />
          </Field>
          <Field id="venue" label="Venue">
            <input
              id="venue"
              className={rsvpField}
              value={venue}
              onChange={(event) => setVenue(event.target.value)}
            />
          </Field>
          <button className={rsvpButton} type="submit" disabled={busy}>
            See my price
          </button>
          <Link
            to="/rsvp/sign-in"
            className="min-h-11 text-sm text-[var(--pink-soft)]"
          >
            Already started? Sign in
          </Link>
          <Link to="/book" className="text-sm text-[var(--text-muted)]">
            New couple? Check a date →
          </Link>
        </form>
      </section>
    </main>
  )
}

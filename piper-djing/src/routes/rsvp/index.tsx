import { Link, useRouter, createFileRoute } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useEffect, useState } from 'react'
import { Header } from '../../components/home/header.tsx'
import { SiteFooter } from '../../components/home/site-footer.tsx'
import { PUBLIC_EMAIL } from '../../lib/crm/defaults.ts'
import { cad } from '../../lib/crm/money.ts'
import { PIPER_RSVP_CENTS, STANDALONE_RSVP_CENTS, priceLabel } from '../../lib/rsvp/model.ts'
import { rsvpHead } from '../../lib/rsvp/head.ts'
import { rsvpHstLabel } from '../../lib/rsvp/purchase.ts'
import type { RsvpQuote } from '../../lib/rsvp/purchase.ts'
import {
  getRsvpSale,
  openRsvpPurchase,
  quoteRsvpCard,
  startRsvpCard,
} from '../../lib/rsvp/rsvp.functions.ts'
import {
  Field,
  rsvpButton,
  rsvpField,
  rsvpGhost,
} from '../../components/rsvp/shell.tsx'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=DM+Sans:wght@400;500;700&display=swap'

export const Route = createFileRoute('/rsvp/')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => {
    const head = rsvpHead('Wedding RSVP · DJ Piper P', true)
    return {
      ...head,
      links: [...head.links, { rel: 'stylesheet', href: FONTS }],
    }
  },
  validateSearch: (search: Record<string, unknown>): { session?: string } =>
    typeof search.session === 'string' && /^cs_[A-Za-z0-9_]+$/.test(search.session)
      ? { session: search.session }
      : {},
  loader: () => getRsvpSale(),
  component: RsvpProduct,
})

function RsvpProduct() {
  const sale = Route.useLoaderData()
  const { session } = Route.useSearch()
  return (
    <div className="home bg-ink-950 text-white">
      <Header anchorBase="/" />
      <main
        className="portal grid lg:grid-cols-2"
        style={{
          backgroundImage:
            'radial-gradient(ellipse at left, #2A1220 0%, #0D0D0D 55%)',
        }}
      >
        <section className="flex flex-col justify-between px-6 py-8 lg:px-12">
          <div>
            <h1 className="portal-display text-5xl lg:text-6xl">
              Your wedding RSVP, handled.
            </h1>
            <p className="mt-4 max-w-md text-[var(--text-muted)]">
              Guest list, meals, and song requests. Your guests get their own
              link to reply.
            </p>
            <div className="mt-6 grid gap-3 sm:grid-cols-2">
              <article className="rounded-3xl border border-[var(--pink)] p-4">
                <p className="text-3xl font-semibold">{priceLabel(PIPER_RSVP_CENTS)}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  With a Piper DJing booking (deposit paid)
                </p>
              </article>
              <article className="rounded-3xl border border-[var(--border)] p-4">
                <p className="text-3xl font-semibold">{priceLabel(STANDALONE_RSVP_CENTS)}</p>
                <p className="mt-1 text-sm text-[var(--text-muted)]">
                  On its own
                </p>
              </article>
            </div>
            <p className="mt-3 text-sm text-[var(--text-faint)]">
              Prices in CAD. Paying by card adds 13% HST.
            </p>
          </div>
          <p className="text-sm text-[var(--text-faint)]">
            Brantford, Ontario · piperpweddingdj.services
          </p>
        </section>
        <section className="flex items-center px-6 py-10 lg:px-12">
          {session ? (
            <Welcome session={session} />
          ) : sale.card ? (
            <BuyForm />
          ) : (
            <ContactUs />
          )}
        </section>
      </main>
      <SiteFooter />
    </div>
  )
}

/** Back from Stripe: wait for the site, then straight into the dashboard. */
function Welcome({ session }: { session: string }) {
  const open = useServerFn(openRsvpPurchase)
  const router = useRouter()
  const [state, setState] = useState<'waiting' | 'email'>('waiting')
  useEffect(() => {
    let tries = 0
    let stopped = false
    const check = async () => {
      if (stopped) return
      tries += 1
      const result = await open({ data: { session } }).catch(() => ({
        state: 'waiting' as const,
      }))
      if (stopped) return
      if (result.state === 'ready') {
        await router.navigate({ to: '/rsvp/manage' })
        return
      }
      if (result.state === 'email' || tries >= 15) {
        setState('email')
        return
      }
      window.setTimeout(() => void check(), 2000)
    }
    void check()
    return () => {
      stopped = true
    }
  }, [open, router, session])
  return (
    <div className="grid w-full max-w-md gap-4" role="status">
      <h2 className="portal-display text-3xl">Thank you!</h2>
      {state === 'waiting' ? (
        <p className="text-[var(--text-muted)]">
          Your payment went through. Setting up your RSVP page…
        </p>
      ) : (
        <>
          <p className="text-[var(--text-muted)]">
            Your payment went through. We emailed you a sign-in link to your
            RSVP dashboard. It works once.
          </p>
          <Link to="/rsvp/sign-in" className={rsvpGhost}>
            Send a new sign-in link
          </Link>
        </>
      )}
    </div>
  )
}

function ContactUs() {
  return (
    <div className="grid w-full max-w-md gap-4">
      <h2 className="portal-display text-3xl">Get your RSVP page</h2>
      <p className="text-[var(--text-muted)]">
        Contact us and we will set up your RSVP page for you.
      </p>
      <a
        className={rsvpButton}
        href={`mailto:${PUBLIC_EMAIL}?subject=${encodeURIComponent('RSVP page')}`}
      >
        Contact us
      </a>
      <Link
        to="/rsvp/sign-in"
        className="min-h-11 text-sm text-[var(--pink-soft)]"
      >
        Already have one? Sign in
      </Link>
    </div>
  )
}

function BuyForm() {
  const quote = useServerFn(quoteRsvpCard)
  const pay = useServerFn(startRsvpCard)
  const [form, setForm] = useState({
    partnerOne: '',
    partnerTwo: '',
    email: '',
    eventDate: '',
    bookingRef: '',
  })
  const [price, setPrice] = useState<RsvpQuote | null>(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [off, setOff] = useState(false)
  const [sent, setSent] = useState(false)
  if (off) return <ContactUs />
  if (sent) {
    return (
      <div className="grid w-full max-w-md gap-4" aria-live="polite">
        <h2 className="portal-display text-3xl">Check your email</h2>
        <p className="text-[var(--text-muted)]">
          Your RSVP page comes free with your Piper booking. We sent the
          sign-in link to {form.email}.
        </p>
      </div>
    )
  }
  const free = price !== null && price.chargeCents === 0
  const update = (key: keyof typeof form) => (event: { target: { value: string } }) => {
    setForm((current) => ({ ...current, [key]: event.target.value }))
    // Any change asks for a fresh price.
    setPrice(null)
  }
  return (
    <form
      className="grid w-full max-w-md gap-4"
      onSubmit={(event) => {
        event.preventDefault()
        setBusy(true)
        setError('')
        if (!price) {
          void quote({ data: form }).then((result) => {
            setBusy(false)
            if (!result.ok) {
              if ('off' in result && result.off) setOff(true)
              setError(result.error)
              return
            }
            setPrice(result.quote)
          })
          return
        }
        void pay({ data: form }).then((result) => {
          if (!result.ok) {
            setBusy(false)
            setError(result.error)
            return
          }
          if ('free' in result) {
            setBusy(false)
            setSent(true)
            return
          }
          window.location.assign(result.url)
        })
      }}
    >
      <h2 className="portal-display text-3xl">Get your RSVP page</h2>
      <p className="text-sm text-[var(--text-muted)]">
        Pay by card and your page is ready right away. We email you a sign-in
        link to your dashboard.
      </p>
      <Field id="one" label="First partner">
        <input id="one" required className={rsvpField} value={form.partnerOne} onChange={update('partnerOne')} />
      </Field>
      <Field id="two" label="Second partner">
        <input id="two" required className={rsvpField} value={form.partnerTwo} onChange={update('partnerTwo')} />
      </Field>
      <Field id="email" label="Your email">
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          className={rsvpField}
          value={form.email}
          onChange={update('email')}
        />
      </Field>
      <Field id="date" label="Wedding date">
        <input id="date" type="date" required className={rsvpField} value={form.eventDate} onChange={update('eventDate')} />
      </Field>
      <Field id="ref" label="Booked with Piper DJing? Booking email or invoice code (optional)">
        <input
          id="ref"
          className={rsvpField}
          placeholder="you@example.com or the code from your invoice link"
          value={form.bookingRef}
          onChange={update('bookingRef')}
        />
      </Field>
      {price && free ? (
        <p className="rounded-2xl border border-[var(--pink)] p-4 text-sm" aria-live="polite">
          Free with your Piper booking. No payment needed.
        </p>
      ) : price ? (
        <dl className="grid gap-1 rounded-2xl border border-[var(--border)] p-4 text-sm" aria-live="polite">
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--text-muted)]">{price.label}</dt>
            <dd className="tabular-nums">{cad(price.baseCents)}</dd>
          </div>
          <div className="flex justify-between gap-3">
            <dt className="text-[var(--text-muted)]">{rsvpHstLabel(price.baseCents)}</dt>
            <dd className="tabular-nums">{cad(price.hstCents)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-t border-[var(--border)] pt-2 font-semibold">
            <dt>Total (CAD)</dt>
            <dd className="tabular-nums">{cad(price.chargeCents)}</dd>
          </div>
        </dl>
      ) : null}
      {error ? (
        <p role="alert" className="text-sm text-[var(--pink-soft)]">
          {error}
        </p>
      ) : null}
      <button className={rsvpButton} type="submit" disabled={busy}>
        {busy
          ? price
            ? free
              ? 'Making your page…'
              : 'Opening secure checkout…'
            : 'Working out your price…'
          : price
            ? free
              ? 'Get my free page'
              : `Pay ${cad(price.chargeCents)} by card`
            : 'See my price'}
      </button>
      {price && !free ? (
        <p className="text-xs text-[var(--text-faint)]">
          You pay on Stripe's secure page, in Canadian dollars.
        </p>
      ) : null}
      <Link to="/rsvp/sign-in" className="min-h-11 text-sm text-[var(--pink-soft)]">
        Already have one? Sign in
      </Link>
      <Link to="/book" className="text-sm text-[var(--text-muted)]">
        New couple? Check a date →
      </Link>
    </form>
  )
}

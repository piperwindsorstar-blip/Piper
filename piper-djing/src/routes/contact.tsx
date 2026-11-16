import { Link, createFileRoute } from '@tanstack/react-router'
import { DateCalendarDialog } from '../components/weddings/date-calendar.tsx'
import { DateDraftProvider } from '../components/weddings/date-draft.tsx'
import { Header } from '../components/weddings/header.tsx'
import { Icon } from '../components/weddings/icon.tsx'
import { SiteFooter } from '../components/weddings/site-footer.tsx'
import {
  FACEBOOK_PAGE_URL,
  INSTAGRAM_URL,
  PUBLIC_EMAIL,
} from '../lib/crm/defaults.ts'
import { publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/contact')({
  head: () =>
    publicHead({
      path: '/contact',
      title: 'Contact | DJ Piper P',
      description:
        'Contact DJ Piper P, a Brantford wedding DJ. Check your date, book your wedding, set up an RSVP page, or email Piper.',
    }),
  component: ContactPage,
})

const card =
  'flex min-h-11 flex-col gap-1 rounded-2xl border border-ink bg-paper p-5 shadow-[4px_4px_0_0_#1C1533] transition hover:-translate-y-0.5'

function ContactPage() {
  return (
    <DateDraftProvider>
      <div className="weddings min-h-screen overflow-x-clip bg-paper font-sans text-ink">
        <Header sectionBase="/weddings" />
        <DateCalendarDialog />
        <main className="mx-auto w-full max-w-2xl px-5 py-16">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-balance md:text-5xl">
            Contact DJ Piper P
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-soft">
            The fastest way to reach Piper is by email. You’ll hear back within
            one business day.
          </p>
          <a
            href={`mailto:${PUBLIC_EMAIL}`}
            className="mt-6 inline-flex min-h-11 items-center gap-2 rounded-full bg-neon px-6 py-3 font-semibold text-white"
          >
            <Icon n="mail" className="h-5 w-5" />
            {PUBLIC_EMAIL}
          </a>
          <div className="mt-10 grid gap-4 sm:grid-cols-2">
            <Link to="/weddings" hash="check-dates" className={card}>
              <span className="font-display text-xl font-bold">Check a date</span>
              <span className="text-sm text-soft">
                See if your wedding date is open.
              </span>
            </Link>
            <Link to="/book" className={card}>
              <span className="font-display text-xl font-bold">Book your wedding</span>
              <span className="text-sm text-soft">
                Pick a package and send your details.
              </span>
            </Link>
            <Link to="/rsvp" className={card}>
              <span className="font-display text-xl font-bold">Wedding RSVP page</span>
              <span className="text-sm text-soft">
                Free with your DJ Piper P booking.
              </span>
            </Link>
            <a href={`mailto:${PUBLIC_EMAIL}`} className={card}>
              <span className="font-display text-xl font-bold">Email Piper</span>
              <span className="text-sm text-soft">
                Questions about anything else.
              </span>
            </a>
          </div>
          <div className="mt-10 flex flex-wrap gap-x-6 gap-y-2 text-sm">
            <a
              href={INSTAGRAM_URL}
              target="_blank"
              rel="noreferrer"
              className="inline-flex min-h-11 items-center gap-1.5 hover:text-neon"
            >
              <Icon n="insta" className="h-4 w-4 text-neon" />
              @DJ_PIPERP
            </a>
            {FACEBOOK_PAGE_URL ? (
              <a
                href={FACEBOOK_PAGE_URL}
                target="_blank"
                rel="noreferrer"
                className="inline-flex min-h-11 items-center gap-1.5 hover:text-neon"
              >
                <Icon n="facebook" className="h-4 w-4 text-neon" />
                Facebook
              </a>
            ) : null}
          </div>
        </main>
        <SiteFooter />
      </div>
    </DateDraftProvider>
  )
}

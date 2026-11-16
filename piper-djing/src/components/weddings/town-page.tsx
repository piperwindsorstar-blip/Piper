import type { PackageOffer } from '../../lib/crm/packages.ts'
import type { PublicReview } from '../../lib/crm/reviews.ts'
import type {
  GoogleReviews,
  ReviewDisplay,
} from '../../lib/crm/google-reviews.ts'
import { publicUrl } from '../../lib/crm/safe-origin.ts'
import {
  professionalServiceJsonLd,
  townLocalBusinessJsonLd,
} from '../../lib/seo.ts'
import { GoogleReviewsSection } from '../google-reviews.tsx'
import { CHECKLIST } from './content.ts'
import { DateCalendarDialog } from './date-calendar.tsx'
import { DateCheckForm } from './date-check-form.tsx'
import { DateDraftProvider } from './date-draft.tsx'
import { Faq } from './faq.tsx'
import { FinalCta } from './final-cta.tsx'
import { Header } from './header.tsx'
import { Packages } from './packages.tsx'
import { Process } from './process.tsx'
import { Reviews } from './reviews.tsx'
import { SiteFooter } from './site-footer.tsx'
import { StickyBookBar } from './sticky-book-bar.tsx'
import { TrustBar } from './trust-bar.tsx'
import type { Town } from './towns.ts'
import { ButtonOutline, ButtonPrimary, Eyebrow } from './ui.tsx'

/** The weddings page, told for one town: its own heading, words and travel answer. */
export function TownPage({
  town,
  reviews,
  packages,
  google = null,
  display = 'both',
}: {
  town: Town
  reviews: PublicReview[]
  packages: PackageOffer[]
  google?: GoogleReviews | null
  display?: ReviewDisplay
}) {
  const googleShown = Boolean(google && google.reviews.length > 0)
  const showMine = display !== 'google' || !googleShown
  return (
    <DateDraftProvider>
      <div
        className={`weddings bp-town bp-town--${town.accent} overflow-x-clip bg-paper pb-20 font-sans text-ink`}
      >
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: professionalServiceJsonLd(packages, town.name),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: townLocalBusinessJsonLd(town) }}
        />
        <Header />
        <DateCalendarDialog />
        <main>
          <section className="bp-full bp-pad">
            <img
              src={town.photo}
              alt=""
              className="bp-bg"
              fetchPriority="high"
              sizes="100vw"
            />
            <div className="bp-hero">
              <div className="min-w-0">
                <p className="bp-k bp-town__accent">{`${town.name} · Wedding DJ`}</p>
                <h1 className="bp-h1 mt-4 text-[clamp(2.9rem,8vw,6rem)]">
                  {`Your ${town.name} `}
                  <span className="bp-town__accent">wedding DJ.</span>
                </h1>
                <p className="mt-5 max-w-xl text-lg leading-relaxed font-medium">
                  {town.intro}
                </p>
                <ul className="mt-6 grid gap-2 font-semibold sm:grid-cols-2">
                  {CHECKLIST.map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <span className="bp-town__accent" aria-hidden="true">
                        ✦
                      </span>
                      {item}
                    </li>
                  ))}
                </ul>
                <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                  <ButtonPrimary>Check Wedding Dates</ButtonPrimary>
                  <ButtonOutline>Explore Wedding Packages</ButtonOutline>
                </div>
              </div>
              <div className="relative min-w-0">
                <DateCheckForm />
              </div>
            </div>
          </section>
          {town.nearby ? (
            <section className="bp-town__local bp-pad">
              <p className="bp-k">{`Weddings in ${town.name}`}</p>
              <p className="bp-town__lead mt-4">{town.nearby}</p>
              {town.venueLine ? (
                <p className="bp-town__lead mt-4">{town.venueLine}</p>
              ) : null}
            </section>
          ) : null}
          <TrustBar />
          <section className="mx-auto max-w-3xl px-5 py-16">
            <Eyebrow>{`${town.name ?? ''} weddings`}</Eyebrow>
            <h2 className="mt-3 font-display text-4xl font-bold text-balance">
              Planned with you, run on time.
            </h2>
            {town.body.map((paragraph) => (
              <p key={paragraph} className="mt-5 text-lg leading-relaxed text-soft">
                {paragraph}
              </p>
            ))}
            <p className="mt-5 text-lg leading-relaxed text-soft">{town.travel}</p>
          </section>
          <Packages packages={packages} />
          <Process />
          {display === 'mine' ? null : (
            <GoogleReviewsSection
              google={google}
              variant="light"
              anchorId={showMine ? 'google-reviews' : 'reviews'}
              pageUrl={publicUrl(town.path)}
            />
          )}
          {showMine ? <Reviews reviews={reviews} /> : null}
          <Faq items={town.faq} />
          <FinalCta />
        </main>
        <SiteFooter />
        <StickyBookBar />
      </div>
    </DateDraftProvider>
  )
}

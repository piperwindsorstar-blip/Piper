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
import { CHECKLIST, RINGS_LOGO_ALT, RINGS_LOGO_SRC } from './content.ts'
import { DateCalendarDialog } from './date-calendar.tsx'
import { DateCheckForm } from './date-check-form.tsx'
import { DateDraftProvider } from './date-draft.tsx'
import { Faq } from './faq.tsx'
import { FinalCta } from './final-cta.tsx'
import { Header } from './header.tsx'
import { Icon } from './icon.tsx'
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
      <div className="weddings overflow-x-clip bg-paper pb-20 font-sans text-ink">
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
          <section className="relative isolate overflow-hidden bg-linear-to-b from-ice/70 via-paper to-paper">
            <div className="grid-lines grid-fade absolute inset-0 -z-10 opacity-60" />
            <div className="absolute -top-32 -right-32 -z-10 h-96 w-96 rounded-full bg-lilac blur-3xl" />
            <div className="absolute top-48 -left-24 -z-10 h-72 w-72 rounded-full bg-blush blur-3xl" />
            <div className="mx-auto grid max-w-6xl items-center gap-12 px-5 pt-14 pb-20 lg:grid-cols-[1.1fr_0.9fr] lg:pt-20">
              <div className="min-w-0">
                <img
                  src={RINGS_LOGO_SRC}
                  alt={RINGS_LOGO_ALT}
                  width={1137}
                  height={1088}
                  className="mx-auto mb-8 block h-auto w-full max-w-[22rem] sm:max-w-[28rem]"
                />
                <h1 className="font-display text-[clamp(2.5rem,6vw,4.9rem)] leading-[0.98] font-extrabold tracking-tight text-balance">
                  {`Your ${town.name} `}
                  <span className="font-serif font-normal text-neon italic">
                    wedding DJ.
                  </span>
                </h1>
                <p className="mt-6 max-w-xl text-lg leading-relaxed text-soft">
                  {town.intro}
                </p>
                <ul className="mt-6 grid gap-2 sm:grid-cols-2">
                  {CHECKLIST.map((item) => (
                    <li key={item} className="flex items-center gap-2 font-medium">
                      <span className="grid h-5 w-5 place-items-center rounded-full bg-blush text-neon">
                        <Icon n="check" className="h-3 w-3" />
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

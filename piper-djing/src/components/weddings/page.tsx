import type { PackageOffer } from '../../lib/crm/packages.ts'
import type { PublicReview } from '../../lib/crm/reviews.ts'
import type {
  GoogleReviews,
  ReviewDisplay,
} from '../../lib/crm/google-reviews.ts'
import { publicUrl } from '../../lib/crm/safe-origin.ts'
import { GoogleReviewsSection } from '../google-reviews.tsx'
import { BrandStrip } from '../brand-strip.tsx'
import type { PublicBrand } from '../../lib/crm/brands.ts'
import { AreaMarquee } from './area-marquee.tsx'
import { DateCalendarDialog } from './date-calendar.tsx'
import { DateDraftProvider } from './date-draft.tsx'
import { Faq } from './faq.tsx'
import { FinalCta } from './final-cta.tsx'
import { GearSection } from './gear-section.tsx'
import { Header } from './header.tsx'
import { Hero } from './hero.tsx'
import { Packages } from './packages.tsx'
import { Process } from './process.tsx'
import { Reviews } from './reviews.tsx'
import { SiteFooter } from './site-footer.tsx'
import { StickyBookBar } from './sticky-book-bar.tsx'
import { TrustBar } from './trust-bar.tsx'
import {
  professionalServiceJsonLd,
  weddingLocalBusinessJsonLd,
} from '../../lib/seo.ts'

export function WeddingsPage({
  reviews,
  packages,
  google = null,
  display = 'both',
  brands = [],
}: {
  reviews: PublicReview[]
  packages: PackageOffer[]
  google?: GoogleReviews | null
  display?: ReviewDisplay
  brands?: PublicBrand[]
}) {
  // "Google only" with nothing from Google still shows the site's own
  // reviews, so the page never loses its reviews or the #reviews anchor.
  const googleShown = Boolean(google && google.reviews.length > 0)
  const showMine = display !== 'google' || !googleShown
  return (
    <DateDraftProvider>
      <div className="weddings overflow-x-clip bg-paper pb-20 font-sans text-ink">
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: professionalServiceJsonLd(packages),
          }}
        />
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: weddingLocalBusinessJsonLd() }}
        />
        <Header />
        <DateCalendarDialog />
        <main>
          <Hero />
          <TrustBar />
          <Packages packages={packages} />
          <AreaMarquee />
          <Process />
          <GearSection />
          <BrandStrip brands={brands} tone="light" />
          {display === 'mine' ? null : (
            <GoogleReviewsSection
              google={google}
              variant="light"
              anchorId={showMine ? 'google-reviews' : 'reviews'}
              pageUrl={publicUrl('/weddings')}
            />
          )}
          {showMine ? <Reviews reviews={reviews} /> : null}
          <Faq />
          <FinalCta />
        </main>
        <SiteFooter />
        <StickyBookBar />
      </div>
    </DateDraftProvider>
  )
}

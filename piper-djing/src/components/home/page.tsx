import type { PublicReview } from '../../lib/crm/reviews.ts'
import type {
  GoogleReviews,
  ReviewDisplay,
} from '../../lib/crm/google-reviews.ts'
import { publicUrl } from '../../lib/crm/safe-origin.ts'
import { GoogleReviewsSection } from '../google-reviews.tsx'
import { BrandStrip } from '../brand-strip.tsx'
import type { PublicBrand } from '../../lib/crm/brands.ts'
import { homeLocalBusinessJsonLd, personJsonLd } from '../../lib/seo.ts'
import { About } from './about.tsx'
import { EventCards } from './event-cards.tsx'
import { FinalCta } from './final-cta.tsx'
import { HIDDEN_HOME_REVIEWS, SCENES } from './content.ts'
import { Header } from './header.tsx'
import { Hero } from './hero.tsx'
import { InstagramStrip } from './instagram-strip.tsx'
import { Packages } from './packages.tsx'
import { Process } from './process.tsx'
import { PromiseTabs } from './promise-tabs.tsx'
import { Reviews } from './reviews.tsx'
import { SiteFooter } from './site-footer.tsx'
import { VenueBand } from './venue-band.tsx'

export function HomePage({
  reviews,
  google = null,
  display = 'both',
  brands = [],
}: {
  reviews: PublicReview[]
  google?: GoogleReviews | null
  display?: ReviewDisplay
  brands?: PublicBrand[]
}) {
  // "Google only" with nothing from Google still shows the site's own
  // reviews, so the page never loses its reviews or the #reviews anchor.
  const googleShown = Boolean(google && google.reviews.length > 0)
  const showMine = display !== 'google' || !googleShown
  return (
    <div className="home bp overflow-x-clip">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: personJsonLd() }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: homeLocalBusinessJsonLd() }}
      />
      <Header />
      <main>
        <Hero />
        <VenueBand />
        <BrandStrip brands={brands} tone="dark" />
        <Packages />
        <About />
        <PromiseTabs />
        <EventCards />
        <Process />
        <div className="bp-full bp-full--dim block">
          <img src={SCENES.reviews} alt="" className="bp-bg" loading="lazy" sizes="100vw" />
          {display === 'mine' ? null : (
            <GoogleReviewsSection
              google={google}
              variant="dark"
              anchorId={showMine ? 'google-reviews' : 'reviews'}
              pageUrl={publicUrl('/')}
              heading="What people say."
              compact
              hideAuthors={HIDDEN_HOME_REVIEWS}
            />
          )}
          {showMine ? <Reviews reviews={reviews} /> : null}
        </div>
        <InstagramStrip />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}

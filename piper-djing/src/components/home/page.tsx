import type { PublicReview } from '../../lib/crm/reviews.ts'
import type {
  GoogleReviews,
  ReviewDisplay,
} from '../../lib/crm/google-reviews.ts'
import { publicUrl } from '../../lib/crm/safe-origin.ts'
import { GoogleReviewsSection } from '../google-reviews.tsx'
import { homeLocalBusinessJsonLd, personJsonLd } from '../../lib/seo.ts'
import { About } from './about.tsx'
import { DateChecker } from './date-checker.tsx'
import { EventCards } from './event-cards.tsx'
import { FinalCta } from './final-cta.tsx'
import { HIDDEN_HOME_REVIEWS } from './content.ts'
import { Header } from './header.tsx'
import { Hero } from './hero.tsx'
import { InstagramStrip } from './instagram-strip.tsx'
import { Marquee } from './marquee.tsx'
import { Process } from './process.tsx'
import { PromiseTabs } from './promise-tabs.tsx'
import { Reviews } from './reviews.tsx'
import { SiteFooter } from './site-footer.tsx'

export function HomePage({
  reviews,
  google = null,
  display = 'both',
}: {
  reviews: PublicReview[]
  google?: GoogleReviews | null
  display?: ReviewDisplay
}) {
  // "Google only" with nothing from Google still shows the site's own
  // reviews, so the page never loses its reviews or the #reviews anchor.
  const googleShown = Boolean(google && google.reviews.length > 0)
  const showMine = display !== 'google' || !googleShown
  return (
    <div className="home overflow-x-clip bg-ink-950 text-white">
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
        <DateChecker />
        <Marquee />
        <About />
        <PromiseTabs />
        <EventCards />
        <Process />
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
        <InstagramStrip />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}

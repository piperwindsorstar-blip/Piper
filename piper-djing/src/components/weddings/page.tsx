import type { PackageOffer } from '../../lib/crm/packages.ts'
import type { PublicReview } from '../../lib/crm/reviews.ts'
import { AreaMarquee } from './area-marquee.tsx'
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
}: {
  reviews: PublicReview[]
  packages: PackageOffer[]
}) {
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
        <main>
          <Hero />
          <TrustBar />
          <Packages packages={packages} />
          <AreaMarquee />
          <Process />
          <GearSection />
          <Reviews reviews={reviews} />
          <Faq />
          <FinalCta />
        </main>
        <SiteFooter />
        <StickyBookBar />
      </div>
    </DateDraftProvider>
  )
}

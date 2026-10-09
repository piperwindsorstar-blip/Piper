import { homeLocalBusinessJsonLd, personJsonLd } from '../../lib/seo.ts'
import { About } from './about.tsx'
import { EventCards } from './event-cards.tsx'
import { FinalCta } from './final-cta.tsx'
import { Header } from './header.tsx'
import { Hero } from './hero.tsx'
import { InstagramStrip } from './instagram-strip.tsx'
import { Marquee } from './marquee.tsx'
import { Process } from './process.tsx'
import { PromiseTabs } from './promise-tabs.tsx'
import { Reviews } from './reviews.tsx'
import { SiteFooter } from './site-footer.tsx'

export function HomePage() {
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
        <Marquee />
        <About />
        <PromiseTabs />
        <EventCards />
        <Process />
        <Reviews />
        <InstagramStrip />
        <FinalCta />
      </main>
      <SiteFooter />
    </div>
  )
}

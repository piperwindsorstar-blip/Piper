import { Link, createFileRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { DateCalendarDialog } from '../components/weddings/date-calendar.tsx'
import { DateDraftProvider } from '../components/weddings/date-draft.tsx'
import { Header } from '../components/weddings/header.tsx'
import { SiteFooter } from '../components/weddings/site-footer.tsx'
import { PUBLIC_EMAIL } from '../lib/crm/defaults.ts'
import { FAQ_CLOSING, FAQ_INTRO, FAQ_SECTIONS, faqJsonLd } from '../lib/faq/content.ts'
import { publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/faq')({
  head: () =>
    publicHead({
      path: '/faq',
      title: 'Wedding DJ FAQ | DJ Piper P',
      description:
        'Answers to what couples ask DJ Piper P before booking: dates, deposits, packages, travel, music, MC and setup for weddings in Brantford and nearby.',
    }),
  component: FaqPage,
})

const link = 'font-semibold text-neon underline underline-offset-2 hover:text-ink'

/** **bold**, the email address and "date checker" as links; words unchanged. */
function rich(text: string): ReactNode[] {
  return text
    .split(/(\*\*[^*]+\*\*|PiperPWeddingDJ@gmail\.com|date checker)/)
    .filter((part) => part !== '')
    .map((part, index) => {
      if (part.startsWith('**')) return <strong key={index}>{part.slice(2, -2)}</strong>
      if (part === 'PiperPWeddingDJ@gmail.com') {
        return (
          <a key={index} href={`mailto:${PUBLIC_EMAIL}`} className={link}>
            {part}
          </a>
        )
      }
      if (part === 'date checker') {
        return (
          <Link key={index} to="/weddings" hash="check-dates" className={link}>
            {part}
          </Link>
        )
      }
      return <span key={index}>{part}</span>
    })
}

function FaqPage() {
  return (
    <DateDraftProvider>
      <div className="weddings min-h-screen overflow-x-clip bg-paper font-sans text-ink">
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: faqJsonLd() }} />
        <Header sectionBase="/weddings" />
        <DateCalendarDialog />
        <main className="mx-auto w-full max-w-3xl px-5 py-16">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-balance md:text-5xl">
            Frequently Asked Questions
          </h1>
          <p className="mt-4 text-lg leading-relaxed text-soft">{rich(FAQ_INTRO)}</p>
          {FAQ_SECTIONS.map((section) => (
            <section key={section.title} className="mt-12">
              <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                {section.title}
              </h2>
              <div className="mt-4 divide-y divide-line border-y border-line">
                {section.items.map((item) => (
                  <div key={item.q} className="py-5">
                    <h3 className="text-lg font-semibold">{item.q}</h3>
                    {Array.isArray(item.a) ? (
                      <ul className="mt-2 grid list-disc gap-1.5 pl-5 leading-relaxed text-soft">
                        {item.a.map((line) => (
                          <li key={line}>{rich(line)}</li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-2 leading-relaxed text-soft">{rich(item.a)}</p>
                    )}
                  </div>
                ))}
              </div>
            </section>
          ))}
          <section className="mt-14 rounded-2xl border border-ink bg-paper p-6 shadow-[4px_4px_0_0_#1C1533]">
            <h2 className="font-display text-2xl font-bold tracking-tight">{FAQ_CLOSING.title}</h2>
            <p className="mt-2 leading-relaxed text-soft">{rich(FAQ_CLOSING.text)}</p>
          </section>
        </main>
        <SiteFooter />
      </div>
    </DateDraftProvider>
  )
}

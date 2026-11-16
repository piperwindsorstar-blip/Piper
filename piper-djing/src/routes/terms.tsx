import { createFileRoute } from '@tanstack/react-router'
import { DateCalendarDialog } from '../components/weddings/date-calendar.tsx'
import { DateDraftProvider } from '../components/weddings/date-draft.tsx'
import { Header } from '../components/weddings/header.tsx'
import { SiteFooter } from '../components/weddings/site-footer.tsx'
import { PUBLIC_EMAIL } from '../lib/crm/defaults.ts'
import { getPublicTerms } from '../lib/crm/public.functions.ts'
import { WEDDING_OG_IMAGE, publicHead } from '../lib/seo.ts'
import { termsBlocks } from '../lib/terms-blocks.ts'

export const Route = createFileRoute('/terms')({
  head: () => {
    const head = publicHead({
      path: '/terms',
      title: 'Terms | DJ Piper P',
      description:
        "Booking terms for DJ Piper P, a Brantford wedding DJ. Deposits, packages, travel and what's included.",
    })
    // The pink-beam share image, the same as /weddings and /book.
    return {
      ...head,
      meta: head.meta.map((item) =>
        'property' in item && item.property === 'og:image'
          ? { property: 'og:image', content: WEDDING_OG_IMAGE }
          : 'property' in item && item.property === 'og:image:width'
            ? { property: 'og:image:width', content: '1152' }
            : 'property' in item && item.property === 'og:image:height'
              ? { property: 'og:image:height', content: '864' }
              : item,
      ),
    }
  },
  loader: () => getPublicTerms(),
  component: TermsPage,
})

function TermsPage() {
  const { body } = Route.useLoaderData()
  return (
    <DateDraftProvider>
      <div className="weddings min-h-screen overflow-x-clip bg-paper font-sans text-ink">
        <Header sectionBase="/weddings" />
        <DateCalendarDialog />
        <main className="mx-auto w-full max-w-2xl px-5 py-16">
          <img
            src="/brand/dj-piper-p-lined.png"
            alt="DJ Piper P"
            className="h-20 w-auto"
          />
          <h1 className="mt-8 font-display text-4xl font-bold tracking-tight">
            Terms
          </h1>
          <div className="mt-8 text-base leading-relaxed text-ink-soft">
            {termsBlocks(body).map((block, index) =>
              block.kind === 'heading' ? (
                <h2
                  key={index}
                  className="mt-10 font-display text-2xl leading-tight font-bold tracking-tight text-ink"
                >
                  {block.text}
                </h2>
              ) : block.kind === 'list' ? (
                <ul key={index} className="mt-4 list-disc space-y-2 pl-5">
                  {block.items.map((item, at) => (
                    <li key={at}>{item}</li>
                  ))}
                </ul>
              ) : (
                <p key={index} className="mt-4">
                  {block.text}
                </p>
              ),
            )}
          </div>
          <p className="mt-10 border-t border-line pt-6 text-sm text-soft">
            {"Questions about these terms? Email "}
            <a
              href={`mailto:${PUBLIC_EMAIL}`}
              className="text-ink underline underline-offset-4"
            >
              {PUBLIC_EMAIL}
            </a>
            .
          </p>
        </main>
        <SiteFooter />
      </div>
    </DateDraftProvider>
  )
}

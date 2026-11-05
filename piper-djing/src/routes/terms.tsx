import { createFileRoute } from '@tanstack/react-router'
import { SiteFooter } from '../components/site-frame.tsx'
import { PUBLIC_EMAIL } from '../lib/crm/defaults.ts'
import { getPublicTerms } from '../lib/crm/public.functions.ts'
import { WEDDING_OG_IMAGE, publicHead } from '../lib/seo.ts'

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
    <div className="weddings min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <main className="mx-auto w-full max-w-2xl px-5 py-16">
        <img
          src="/brand/dj-piper-p-lined.png"
          alt="DJ Piper P"
          className="h-20 w-auto"
        />
        <h1 className="mt-8 font-display text-4xl font-bold tracking-tight">
          Terms
        </h1>
        <pre className="mt-8 text-base leading-relaxed whitespace-pre-wrap text-ink-soft">
          {body}
        </pre>
        <p className="mt-8 border-t border-line pt-6 text-sm text-soft">
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
  )
}

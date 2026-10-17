import { createFileRoute } from '@tanstack/react-router'
import { SiteFooter } from '../components/site-frame.tsx'
import { PUBLIC_EMAIL } from '../lib/crm/defaults.ts'
import { getPublicTerms } from '../lib/crm/public.functions.ts'
import { publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/terms')({
  head: () =>
    publicHead({
      path: '/terms',
      title: 'Terms | DJ Piper P',
    }),
  loader: () => getPublicTerms(),
  component: TermsPage,
})

function TermsPage() {
  const { body } = Route.useLoaderData()
  return (
    <div className="weddings min-h-screen overflow-x-clip bg-paper font-sans text-ink">
      <main className="mx-auto w-full max-w-2xl px-5 py-16">
        <img
          src="/photos/logo-inverted.png"
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
          Questions about these terms? Email{' '}
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

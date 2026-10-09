import { createFileRoute } from '@tanstack/react-router'
import { Landing } from '../components/landing.tsx'
import { getPublicSite } from '../lib/crm/public.functions.ts'
import { publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/weddings')({
  loader: () => getPublicSite(),
  head: () =>
    publicHead({
      path: '/weddings',
      title:
        'Brantford Wedding DJ & The Ultimate Dance Floor Experience | Piper DJing',
    }),
  component: Weddings,
})

function Weddings() {
  const { reviews, partners } = Route.useLoaderData()
  return <Landing reviews={reviews} partners={partners} />
}

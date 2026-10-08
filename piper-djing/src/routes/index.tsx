import { createFileRoute } from '@tanstack/react-router'
import { Landing } from '../components/landing.tsx'
import { getPublicSite } from '../lib/crm/public.functions.ts'
import { publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/')({
  loader: () => getPublicSite(),
  head: () =>
    publicHead({
      path: '/',
      title:
        'Brantford Wedding DJ & The Ultimate Dance Floor Experience | Piper DJing',
    }),
  component: Home,
})

function Home() {
  const { reviews, partners } = Route.useLoaderData()
  return <Landing reviews={reviews} partners={partners} />
}

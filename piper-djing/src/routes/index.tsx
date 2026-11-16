import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '../components/home/page.tsx'
import { getPublicSite } from '../lib/crm/public.functions.ts'
import { HOME_DESCRIPTION, WEDDING_OG_IMAGE, publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/')({
  loader: () => getPublicSite(),
  staleTime: 5 * 60 * 1000,
  head: () => {
    const head = publicHead({
      path: '/',
      title: 'Brantford wedding DJ | DJ Piper P',
      description: HOME_DESCRIPTION,
    })
    return {
      ...head,
      meta: head.meta
        .map((item) =>
          'property' in item && item.property === 'og:image'
            ? { ...item, content: WEDDING_OG_IMAGE }
            : item,
        )
        .concat({ name: 'theme-color', content: '#0D0D0D' }),
    }
  },
  component: Home,
})

function Home() {
  const { reviews, google, reviewDisplay, brands } = Route.useLoaderData()
  return (
    <HomePage
      reviews={reviews}
      google={google}
      display={reviewDisplay.home}
      brands={brands}
    />
  )
}

import { createFileRoute } from '@tanstack/react-router'
import { WeddingsPage } from '../components/weddings/page.tsx'
import { getPublicSite } from '../lib/crm/public.functions.ts'
import {
  WEDDING_DESCRIPTION,
  WEDDING_OG_IMAGE,
  publicHead,
} from '../lib/seo.ts'

export const Route = createFileRoute('/weddings')({
  loader: () => getPublicSite(),
  staleTime: 5 * 60 * 1000,
  head: () => {
    const head = publicHead({
      path: '/weddings',
      title: 'Wedding DJ in Brantford, Ontario | DJ Piper P',
      description: WEDDING_DESCRIPTION,
    })
    return {
      ...head,
      meta: [
        ...head.meta.map((item) => {
          if ('property' in item && item.property === 'og:image') {
            return { property: 'og:image', content: WEDDING_OG_IMAGE }
          }
          if ('property' in item && item.property === 'og:image:width') {
            return { property: 'og:image:width', content: '1152' }
          }
          if ('property' in item && item.property === 'og:image:height') {
            return { property: 'og:image:height', content: '864' }
          }
          return item
        }),
        { name: 'theme-color', content: '#FFFFFF' },
      ],
    }
  },
  component: Weddings,
})

function Weddings() {
  const { reviews, packages, google, reviewDisplay, brands } = Route.useLoaderData()
  return (
    <WeddingsPage
      reviews={reviews}
      packages={packages}
      google={google}
      display={reviewDisplay.weddings}
      brands={brands}
    />
  )
}

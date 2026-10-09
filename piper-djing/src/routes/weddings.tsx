import { createFileRoute } from '@tanstack/react-router'
import { WeddingsPage } from '../components/weddings/page.tsx'
import { getPublicSite } from '../lib/crm/public.functions.ts'
import {
  WEDDING_DESCRIPTION,
  WEDDING_OG_IMAGE,
  publicHead,
} from '../lib/seo.ts'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap'

export const Route = createFileRoute('/weddings')({
  loader: () => getPublicSite(),
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
      links: [...head.links, { rel: 'stylesheet', href: FONTS }],
    }
  },
  component: Weddings,
})

function Weddings() {
  Route.useLoaderData()
  return <WeddingsPage />
}

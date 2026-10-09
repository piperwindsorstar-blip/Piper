import { createFileRoute } from '@tanstack/react-router'
import { HomePage } from '../components/home/page.tsx'
import { HOME_DESCRIPTION, WEDDING_OG_IMAGE, publicHead } from '../lib/seo.ts'

const fonts =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=Instrument+Serif:ital@0;1&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap'

export const Route = createFileRoute('/')({
  head: () => {
    const head = publicHead({
      path: '/',
      title: 'DJ Piper P | Wedding & Event DJ in Brantford, Ontario',
      description: HOME_DESCRIPTION,
    })
    return {
      ...head,
      links: [...head.links, { rel: 'stylesheet', href: fonts }],
      meta: head.meta
        .map((item) =>
          'property' in item && item.property === 'og:image'
            ? { ...item, content: WEDDING_OG_IMAGE }
            : item,
        )
        .concat({ name: 'theme-color', content: '#0D0D0D' }),
    }
  },
  component: HomePage,
})

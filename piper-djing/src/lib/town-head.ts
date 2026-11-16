import type { Town } from '../components/weddings/towns.ts'
import { WEDDING_OG_IMAGE, publicHead } from './seo.ts'

/** A town page's head: its own title, description and canonical address. */
export function townHead(town: Pick<Town, 'path' | 'title' | 'description'>) {
  const head = publicHead({
    path: town.path,
    title: town.title,
    description: town.description,
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
}

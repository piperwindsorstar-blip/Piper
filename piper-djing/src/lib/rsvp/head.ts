import { publicUrl } from '../crm/safe-origin.ts'
import { WEDDING_OG_IMAGE } from '../seo.ts'
import { INVITE_FONTS_URL } from './invite-fonts.ts'

export const RSVP_FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Display:wght@800;900&display=swap'

export function rsvpHead(title: string, index = false, path = '/rsvp') {
  const description =
    'A private wedding RSVP from DJ Piper P. $20 with a paid Piper date, $30 on its own. Your guests get their own link to reply.'
  return {
    meta: [
      { title },
      {
        name: 'robots',
        content: index ? 'index, follow' : 'noindex, nofollow',
      },
      { name: 'theme-color', content: '#0D0D0D' },
      ...(index
        ? [
            { name: 'description', content: description },
            { property: 'og:title', content: title },
            { property: 'og:description', content: description },
            { property: 'og:url', content: publicUrl(path) },
            { property: 'og:image', content: WEDDING_OG_IMAGE },
            { name: 'twitter:card', content: 'summary_large_image' },
          ]
        : []),
    ],
    links: [
      { rel: 'stylesheet', href: RSVP_FONTS },
      // The invitation typefaces: one small stylesheet; each font file loads only when a card uses it.
      { rel: 'stylesheet', href: INVITE_FONTS_URL },
      ...(index ? [{ rel: 'canonical', href: publicUrl(path) }] : []),
    ],
  }
}

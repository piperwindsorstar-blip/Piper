export const RSVP_FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Display:wght@800;900&display=swap'

export function rsvpHead(title: string, index = false) {
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
            {
              name: 'description',
              content:
                'A private wedding RSVP from DJ Piper P. $20 with a paid Piper date, $30 on its own. Your guests get their own link to reply.',
            },
          ]
        : []),
    ],
    links: [{ rel: 'stylesheet', href: RSVP_FONTS }],
  }
}

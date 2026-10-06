import { PACKAGE_BUTTON_COPY, PUBLIC_EMAIL, INSTAGRAM_URL } from './crm/defaults.ts'
import { publicUrl } from './crm/safe-origin.ts'
import site from './og/site.json'

function lockedUrl(path: string): string {
  const base = site.url.replace(/\/$/, '')
  if (path === '/') return `${base}/`
  return `${base}${path}`
}

export function publicHead(opts: { path: '/' | '/book'; title: string }) {
  const canonical = publicUrl(opts.path)
  const ogUrl = lockedUrl(opts.path)
  return {
    meta: [
      { title: opts.title },
      { name: 'description', content: site.description },
      { name: 'robots', content: 'index, follow' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { property: 'og:title', content: site.title },
      { property: 'og:description', content: site.description },
      { property: 'og:image', content: site.image },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:url', content: ogUrl },
    ],
    links: [
      { rel: 'canonical', href: canonical },
      ...(opts.path === '/'
        ? [
            { rel: 'preload', as: 'image', href: '/photos/logo-inverted.png' },
            { rel: 'preload', as: 'image', href: '/photos/spotlight.jpg' },
            { rel: 'preload', as: 'image', href: '/photos/dance.jpg' },
            { rel: 'preload', as: 'image', href: '/photos/spin.jpg' },
          ]
        : []),
    ],
  }
}

export function privateHead(title: string) {
  return {
    meta: [
      { title },
      { name: 'robots', content: 'noindex, nofollow' },
    ],
  }
}

export function professionalServiceJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Piper DJing',
    url: lockedUrl('/'),
    image: 'https://piperpweddingdj.services/photos/spotlight.jpg',
    description: site.description,
    email: PUBLIC_EMAIL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Brantford',
      addressRegion: 'ON',
      addressCountry: 'CA',
    },
    areaServed: [
      { '@type': 'City', name: 'Brantford' },
      { '@type': 'City', name: 'Hamilton' },
      { '@type': 'City', name: 'Cambridge' },
      {
        '@type': 'City',
        name: 'Paris',
        containedInPlace: { '@type': 'AdministrativeArea', name: 'Ontario' },
      },
      { '@type': 'AdministrativeArea', name: 'Brant County' },
    ],
    serviceType: 'Wedding DJ',
    sameAs: [INSTAGRAM_URL],
    offers: PACKAGE_BUTTON_COPY.map((item) => ({
      '@type': 'Offer',
      name: item.name,
    })),
  })
}

import {
  PACKAGE_BUTTON_COPY,
  PUBLIC_EMAIL,
  INSTAGRAM_URL,
} from './crm/defaults.ts'
import { PACKAGE_CENTS } from './piper/rules.ts'
import { publicUrl } from './crm/safe-origin.ts'
import site from './og/site.json' with { type: 'json' }

function lockedUrl(path: string): string {
  const base = site.url.replace(/\/$/, '')
  if (path === '/') return `${base}/`
  return `${base}${path}`
}

export const BRAND_DESCRIPTION =
  'DJ Piper P is Piper DJing in Brantford. See the booth, follow @DJ_PIPERP, and open wedding dates.'

export const WEDDING_DESCRIPTION =
  'Custom playlists, premium sound and lighting, and stress-free coordination for weddings in Brantford, Paris, Hamilton, Cambridge, and nearby Ontario.'

export const WEDDING_OG_IMAGE = `${site.url}/photos/brand/brand-beam.jpg`

export function publicHead(opts: {
  path: '/' | '/book' | '/weddings'
  title: string
  description?: string
}) {
  const canonical = publicUrl(opts.path)
  const ogUrl = lockedUrl(opts.path)
  const description = opts.description ?? site.description
  return {
    meta: [
      { title: opts.title },
      { name: 'description', content: description },
      { name: 'robots', content: 'index, follow' },
      { name: 'twitter:card', content: 'summary_large_image' },
      { property: 'og:title', content: opts.title },
      { property: 'og:description', content: description },
      { property: 'og:image', content: site.image },
      { property: 'og:image:width', content: '1200' },
      { property: 'og:image:height', content: '630' },
      { property: 'og:url', content: ogUrl },
    ],
    links: [{ rel: 'canonical', href: canonical }],
  }
}

export function privateHead(title: string) {
  return {
    meta: [{ title }, { name: 'robots', content: 'noindex, nofollow' }],
  }
}

export function professionalServiceJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'Piper DJing',
    url: lockedUrl('/weddings'),
    image: [
      `${site.url}/photos/dj-piper-at-the-booth.jpg`,
      `${site.url}/photos/wedding-reception-dance.jpg`,
      `${site.url}/photos/wedding-first-dance.jpg`,
    ],
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
      price: (PACKAGE_CENTS[item.id] / 100).toFixed(2),
      priceCurrency: 'CAD',
    })),
  })
}

export function weddingLocalBusinessJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'DJ Piper P',
    url: lockedUrl('/weddings'),
    image: WEDDING_OG_IMAGE,
    description: WEDDING_DESCRIPTION,
    email: PUBLIC_EMAIL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Brantford',
      addressRegion: 'ON',
      addressCountry: 'CA',
    },
    areaServed: [
      'Brantford',
      'Paris',
      'Hamilton',
      'Cambridge',
      'Woodstock',
      'Burlington',
      'Guelph',
      'Oakville',
    ].map((name) => ({ '@type': 'City', name })),
    sameAs: [INSTAGRAM_URL],
  })
}

export function personJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'Person',
    name: 'DJ Piper P',
    alternateName: 'Piper DJing',
    url: lockedUrl('/'),
    image: [
      `${site.url}/photos/logo-inverted.png`,
      `${site.url}/photos/dj-piper-at-the-booth.jpg`,
    ],
    description: BRAND_DESCRIPTION,
    jobTitle: 'DJ',
    email: PUBLIC_EMAIL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Brantford',
      addressRegion: 'ON',
      addressCountry: 'CA',
    },
    sameAs: [INSTAGRAM_URL],
  })
}

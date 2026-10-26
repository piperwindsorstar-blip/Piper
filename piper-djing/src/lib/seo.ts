import {
  PACKAGE_BUTTON_COPY,
  PUBLIC_EMAIL,
  INSTAGRAM_URL,
  FACEBOOK_PAGE_URL,
} from './crm/defaults.ts'
import { PACKAGE_CENTS } from './piper/rules.ts'
import { publicUrl } from './crm/safe-origin.ts'
import site from './og/site.json' with { type: 'json' }

const SAME_AS = [INSTAGRAM_URL, FACEBOOK_PAGE_URL].filter(Boolean)

function lockedUrl(path: string): string {
  const base = site.url.replace(/\/$/, '')
  if (path === '/') return `${base}/`
  return `${base}${path}`
}

export const HOME_DESCRIPTION =
  'Brantford wedding DJ Piper P is a warm, well-planned, flexible DJ for weddings, private events, charity and community events in Brantford, Ontario and the surrounding area.'

export const WEDDING_DESCRIPTION =
  'Custom playlists, premium sound and lighting, and stress-free coordination for weddings in Brantford, Paris, Hamilton, Cambridge, and nearby Ontario.'

export const WEDDING_OG_IMAGE = `${site.url}/photos/brand/brand-beam.jpg`

export function publicHead(opts: {
  path:
    | '/'
    | '/book'
    | '/weddings'
    | '/terms'
    | '/contact'
    | '/rsvp'
    | '/hamilton-wedding-dj'
    | '/cambridge-wedding-dj'
    | '/paris-wedding-dj'
    | '/woodstock-wedding-dj'
    | '/burlington-wedding-dj'
    | '/guelph-wedding-dj'
    | '/oakville-wedding-dj'
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

/** Piper is a member of the Canadian Professional DJ Association. */
const CPDJA = {
  '@type': 'Organization',
  name: 'Canadian Professional Disc Jockey Association',
  alternateName: 'CPDJA',
  url: 'https://cpdja.ca',
}

/** Towns already named in the shared areaServed list. */
const BASE_TOWNS = ['Brantford', 'Hamilton', 'Cambridge', 'Paris']

export function professionalServiceJsonLd(
  offers?: { name: string; cents: number }[],
  /** A town page's town, added to areaServed when it isn't listed already. */
  townName?: string,
): string {
  const priced =
    offers ??
    PACKAGE_BUTTON_COPY.map((item) => ({
      name: item.name,
      cents: PACKAGE_CENTS[item.id],
    }))
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ProfessionalService',
    name: 'DJ Piper P',
    alternateName: 'Piper DJing',
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
      ...(townName && !BASE_TOWNS.includes(townName)
        ? [
            {
              '@type': 'City',
              name: townName,
              containedInPlace: { '@type': 'AdministrativeArea', name: 'Ontario' },
            },
          ]
        : []),
    ],
    serviceType: 'Wedding DJ',
    sameAs: SAME_AS,
    memberOf: CPDJA,
    offers: priced.map((item) => ({
      '@type': 'Offer',
      name: item.name,
      price: (item.cents / 100).toFixed(2),
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
    areaServed: ['Brantford', 'Hamilton', 'Cambridge', 'Paris'].map(
      (name) => ({ '@type': 'City', name }),
    ).concat({
      '@type': 'AdministrativeArea',
      name: 'Brant County',
    }),
    sameAs: SAME_AS,
    memberOf: CPDJA,
  })
}

/** A town page: the same business, described for one town it serves. */
export function townLocalBusinessJsonLd(town: {
  path: string
  name: string
  description: string
}): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'DJ Piper P',
    url: lockedUrl(town.path),
    image: WEDDING_OG_IMAGE,
    description: town.description,
    email: PUBLIC_EMAIL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Brantford',
      addressRegion: 'ON',
      addressCountry: 'CA',
    },
    areaServed: {
      '@type': 'City',
      name: town.name,
      containedInPlace: { '@type': 'AdministrativeArea', name: 'Ontario' },
    },
    serviceType: 'Wedding DJ',
    sameAs: SAME_AS,
    memberOf: CPDJA,
  })
}

export function homeLocalBusinessJsonLd(): string {
  return JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'LocalBusiness',
    name: 'DJ Piper P',
    url: lockedUrl('/'),
    image: WEDDING_OG_IMAGE,
    description: HOME_DESCRIPTION,
    email: PUBLIC_EMAIL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Brantford',
      addressRegion: 'ON',
      addressCountry: 'CA',
    },
    areaServed: ['Brantford', 'Hamilton', 'Cambridge', 'Paris']
      .map((name) => ({ '@type': 'City', name }))
      .concat({ '@type': 'AdministrativeArea', name: 'Brant County' }),
    sameAs: SAME_AS,
    memberOf: CPDJA,
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
    description: HOME_DESCRIPTION,
    jobTitle: 'DJ',
    email: PUBLIC_EMAIL,
    address: {
      '@type': 'PostalAddress',
      addressLocality: 'Brantford',
      addressRegion: 'ON',
      addressCountry: 'CA',
    },
    sameAs: SAME_AS,
    memberOf: CPDJA,
  })
}

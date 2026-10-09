/** Public package lines. Names and what is included. No prices in this copy. */
export const PACKAGE_BUTTON_COPY = [
  {
    id: 'full',
    name: 'Full wedding day',
    detail:
      'From the ceremony through the reception, up to 1:00 a.m. Wireless microphones for the ceremony and the reception, two speakers, dancefloor lighting, and backup. Pre-planning and at least one meeting. Light MC for introducing speeches, if you ask.',
    includes: [
      'Ceremony audio through the reception, up to 1:00 a.m.',
      'Wireless microphones for the ceremony and the speeches',
      'Two speakers and dancefloor lighting',
      'Backup equipment',
      'Pre-planning and at least one meeting',
      'Light MC for introducing speeches, if you ask',
    ],
  },
  {
    id: 'reception',
    name: 'Reception only',
    detail:
      'The reception only, without ceremony audio, up to 1:00 a.m. Wireless microphones, two speakers, dancefloor lighting, backup, pre-planning, at least one meeting, and light MC if you ask.',
    includes: [
      'The reception, up to 1:00 a.m.',
      'Wireless microphones and two speakers',
      'Dancefloor lighting',
      'Backup equipment',
      'Pre-planning and at least one meeting',
      'Light MC, if you ask',
    ],
  },
  {
    id: 'stag',
    name: 'A stag and doe',
    detail:
      'Up to 1:00 a.m. The DJ, two speakers, one wireless microphone, dancefloor lighting, backup, and MC duties.',
    includes: [
      'Up to 1:00 a.m.',
      'Two speakers and one wireless microphone',
      'Dancefloor lighting',
      'Backup equipment',
      'DJ and MC duties',
    ],
  },
  {
    id: 'ceremony',
    name: 'Ceremony only',
    detail:
      'Ceremony audio only. One speaker, one wireless microphone, backup, and at least one planning meeting. No reception, no dancefloor lighting, and no MC. The officiant conducts the ceremony.',
    includes: [
      'Ceremony audio only',
      'One speaker and one wireless microphone for the officiant',
      'Backup equipment',
      'At least one planning meeting',
      'No reception audio, dancefloor lighting, or MC',
    ],
  },
] as const

export type PackageId = (typeof PACKAGE_BUTTON_COPY)[number]['id']

export function isPackageId(value: string): value is PackageId {
  return PACKAGE_BUTTON_COPY.some((item) => item.id === value)
}

export function packageName(id: PackageId): string {
  return PACKAGE_BUTTON_COPY.find((item) => item.id === id)?.name ?? id
}

export const PUBLIC_EMAIL = 'PiperPWeddingDJ@gmail.com'
export const INSTAGRAM_URL = 'https://www.instagram.com/dj_piperp/'
export const GOOGLE_REVIEW_URL = 'https://g.page/r/CZeXBF6gallvEAI/review'

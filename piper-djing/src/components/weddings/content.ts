import { GOOGLE_REVIEW_URL, PUBLIC_EMAIL } from '../../lib/crm/defaults.ts'

export const LINKS = {
  weddings: '/weddings',
  book: '/book',
  review: GOOGLE_REVIEW_URL,
  insta: 'https://instagram.com/DJ_PIPERP',
  email: PUBLIC_EMAIL,
} as const

export const LOGO_SRC = '/photos/logo-inverted.png'
export const LOGO_ALT = 'DJ Piper P'

export const PHOTOS = {
  mixer: '/photos/brand/brand-mixer.jpg',
  phones: '/photos/brand/brand-phones.jpg',
  beam: '/photos/brand/brand-beam.jpg',
  stack: '/photos/brand/brand-stack.jpg',
} as const

export const TIERS = [
  {
    n: 'The Main Event',
    plain: 'Full Wedding Day',
    price: '$1,650',
    f: [
      'Ceremony audio through the reception, up to 1:00 a.m.',
      'Wireless microphones for the ceremony and speeches',
      'Two speakers',
      'Dancefloor lighting',
      'Backup equipment',
      'At least one planning meeting',
      'Light MC duties',
    ],
    hl: true,
  },
  {
    n: 'The After Party',
    plain: 'Reception Only',
    price: '$1,550',
    f: [
      'The reception up to 1:00 a.m.',
      'Wireless microphones',
      'Two speakers',
      'Dancefloor lighting',
      'Backup equipment',
      'At least one planning meeting',
      'Light MC duties',
    ],
    hl: false,
  },
  {
    n: 'The Pre-Party',
    plain: 'Stag and Doe',
    price: '$700',
    f: [
      'Up to 1:00 a.m.',
      'Two speakers',
      'One wireless microphone',
      'Dancefloor lighting',
      'Backup equipment',
      'DJ and MC duties',
    ],
    hl: false,
  },
  {
    n: 'The Aisle',
    plain: 'Ceremony Only',
    price: '$350 paid in full',
    f: [
      'Ceremony audio',
      'One speaker and one wireless microphone for the officiant',
      'Backup equipment',
      'At least one planning meeting',
      'No dancefloor lighting or MC',
    ],
    hl: false,
  },
]

export const STEPS = [
  {
    t: 'Check your date',
    d: 'Send your date and venue. You hear back within one business day.',
  },
  {
    t: 'Planning call',
    d: 'A relaxed chat about your families, your crowd and the songs that matter.',
  },
  {
    t: 'Build the night',
    d: 'Must-play and do-not-play lists, timeline, mic cues and lighting, confirmed in writing.',
  },
  {
    t: 'Celebrate',
    d: 'Piper arrives early, sets up, sound checks and runs the night while you enjoy it.',
  },
]

export const GEAR = [
  {
    i: 'headphones' as const,
    t: 'The Booth',
    d: 'Pro controller, backup gear and a clean, low-profile setup.',
  },
  {
    i: 'speaker' as const,
    t: 'The Sound',
    d: 'Full-range audio tuned to your room, clear speeches and a floor that hits.',
  },
  {
    i: 'bulb' as const,
    t: 'The Lighting',
    d: 'Dancefloor lighting that takes the room from dinner glow to full dance energy.',
  },
  {
    i: 'heart' as const,
    t: 'The Vibe',
    d: 'Warm, funny, never cheesy. Comfortable for family, electric for friends.',
  },
]

// TODO: real FAQ answers. This copy is a draft.
export const FAQ = [
  [
    'How far ahead should we book?',
    'Popular Saturdays in summer and early fall go first, so reach out as soon as your venue is confirmed.',
  ],
  [
    'Do you travel outside Brantford?',
    'Yes. Piper plays weddings across Brantford, Paris, Hamilton, Cambridge and surrounding areas. Travel details are included in your quote.',
  ],
  [
    'Can we control the music?',
    'Completely. Send must-play, do-not-play and special-moment songs. Piper handles the flow and transitions.',
  ],
  [
    'Do you work with our planner and venue?',
    'Always. Piper confirms timelines, power, load-in and sound limits ahead of time so the day runs quietly in the background.',
  ],
] as const

export const AREAS = [
  'Brantford',
  'Paris',
  'Hamilton',
  'Cambridge',
  'Woodstock',
  'Burlington',
  'Guelph',
  'Oakville',
]

export const NAV = [
  ['Packages', '#packages'],
  ['Process', '#process'],
  ['The Booth', '#the-booth'],
  ['Reviews', '#reviews'],
  ['FAQ', '#faq'],
] as const

export const CHECKLIST = [
  'Custom playlists',
  'Pro sound & lighting',
  'Planner-friendly coordination',
  'Backup gear included',
]

export const TRUST = [
  ['zap', 'Reply within one business day'],
  ['mic', 'Backup gear on site'],
  ['pin', 'Brantford & area'],
] as const

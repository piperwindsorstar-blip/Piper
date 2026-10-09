import { GOOGLE_REVIEW_URL, PUBLIC_EMAIL } from '../../lib/crm/defaults.ts'

export const SHOW_PLACEHOLDER_NOTES = false as boolean

export const LINKS = {
  weddings: '/weddings',
  book: '/book',
  review: GOOGLE_REVIEW_URL,
  insta: 'https://instagram.com/DJ_PIPERP',
  email: PUBLIC_EMAIL,
} as const

export const PHOTOS = {
  mixer: '/photos/brand/brand-mixer.jpg',
  phones: '/photos/brand/brand-phones.jpg',
  beam: '/photos/brand/brand-beam.jpg',
  stack: '/photos/brand/brand-stack.jpg',
} as const

// TODO: real Google reviews. These quotes are sample copy and have no couple names.
export const REVIEWS = [
  {
    q: 'Our dance floor was full from the first song to the last. Piper read the room, kept the grandparents and the college friends happy, and never once made an awkward announcement.',
    w: 'Wedding · Brantford',
  },
  {
    q: 'Zero stress. We handed over our must-play and do-not-play lists and the night just flowed. The lighting made the whole venue feel like a different place.',
    w: 'Reception · Paris, ON',
  },
  {
    q: 'Every transition was smooth, the sound was crisp at the back of the hall, and guests are still asking who our DJ was.',
    w: 'Wedding · Hamilton',
  },
]

// TODO: real packages. Names and inclusions are placeholders.
export const TIERS = [
  {
    n: 'Essentials',
    tag: 'Reception only',
    f: [
      'Up to 5 hours of music',
      'Premium sound system',
      'Wireless mic for toasts',
      'Custom must-play list',
    ],
    hl: false,
  },
  {
    n: 'Signature',
    tag: 'Most popular',
    f: [
      'Ceremony + reception coverage',
      'Programmable uplighting',
      'Planning call and timeline',
      'Grand entrance and first dance mixes',
      'Backup gear on site',
    ],
    hl: true,
  },
  {
    n: 'Full Experience',
    tag: 'Everything, handled',
    f: [
      'Everything in Signature',
      'Dance-floor lighting package',
      'Cocktail-hour set',
      'Extended hours available',
      'Priority planner coordination',
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
    d: 'Color washes and beams that move from dinner glow to full dance energy.',
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
  ['star', '5.0 on Google'],
  ['zap', 'Reply in 24 hours'],
  ['mic', 'Backup gear on site'],
  ['pin', 'Brantford & area'],
] as const

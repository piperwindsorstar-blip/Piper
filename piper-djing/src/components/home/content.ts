import { FACEBOOK_PAGE_URL } from '../../lib/crm/defaults.ts'

export const PHOTOS = {
  mixer: '/photos/brand/brand-mixer.jpg',
  phones: '/photos/brand/brand-phones.jpg',
  beam: '/photos/brand/brand-beam.jpg',
  stack: '/photos/brand/brand-stack.jpg',
}

/** Set this to a portrait path to replace the labeled placeholder. */
export const LOGO_SRC = '/brand/dj-piper-p.png'
export const LOGO_ALT = 'DJ Piper P'
export const PORTRAIT_SRC = '/photos/dj-piper-at-the-booth.jpg'
export const PORTRAIT_ALT = 'DJ Piper P at the booth.'

/** Sample review and Instagram notes stay hidden until real content replaces them. */
export const SHOW_PLACEHOLDER_NOTES = false as boolean

/**
 * Google reviewer names to leave out of the homepage reviews, e.g.
 * ['Jane Doe']. Reviews always show exactly as Google returns them.
 */
export const HIDDEN_HOME_REVIEWS: readonly string[] = []

export const LINKS = {
  weddings: '/weddings',
  book: '/book',
  review: 'https://g.page/r/CZeXBF6gallvEAI/review',
  insta: 'https://www.instagram.com/dj_piperp',
  email: 'PiperPWeddingDJ@gmail.com',
  facebook: FACEBOOK_PAGE_URL,
  contact: '/contact',
  bulls: 'https://www.facebook.com/share/1CHxV2PubR/',
} as const

export const NAV = [
  { label: 'About', href: '#about' },
  { label: 'Promise', href: '#promise' },
  { label: 'Events', href: '#events' },
  { label: 'Process', href: '#process' },
  { label: 'Reviews', href: '#reviews' },
  { label: 'Vendors', href: '/wedding-vendors' },
] as const

export const TAGS = [
  'Weddings',
  'Private Events',
  'Charity Events',
  'Community Events',
  'Club Nights',
  'Open Format',
  'Custom Playlists',
  'Pro Sound & Light',
]

export const PILLARS = [
  {
    k: 'Personality',
    i: 'mic',
    h: 'A DJ with a pulse.',
    d: 'I’m warm, funny and easy to talk to. I’m the DJ who says hi to your grandmother, and the one your friends are still talking about on Monday.',
    pts: [
      'I use real banter, never cheesy scripts.',
      'I read the room before I pick the next song.',
      'I lift the energy without taking over the night.',
    ],
  },
  {
    k: 'Service',
    i: 'heart',
    h: 'You are never a ticket number.',
    d: 'You get fast replies, clear answers and one person who knows your event inside out. You deal with me, not a booking queue.',
    pts: [
      'I reply within one business day.',
      'My quotes are straightforward, with no surprise add-ons.',
      'I follow up after your event.',
    ],
  },
  {
    k: 'Planning',
    i: 'list',
    h: 'Nothing left to chance.',
    d: 'We start with a short planning call, a written timeline and a music brief. By event day, every cue, mic and playlist is already sorted.',
    pts: [
      'You give me must-play and do-not-play lists.',
      'I share the timeline with your planner and venue.',
      'I arrive early and run a full sound check.',
    ],
  },
  {
    k: 'Flexibility',
    i: 'sliders',
    h: 'Plans change. I adjust.',
    d: 'Dinner runs late, the speeches go long, or the crowd wants something different. I adapt in real time and keep the night flowing.',
    pts: [
      'I play open format, with any mix of genres.',
      'I adjust the timeline on the fly without any stress.',
      'I’m comfortable with any crowd, from weddings to club nights.',
    ],
  },
  {
    k: 'Kindness',
    i: 'smile',
    h: 'Everyone gets a good night.',
    d: 'I’m inclusive, respectful and welcoming to every guest. A great party is one where everybody feels they belong on the dance floor.',
    pts: [
      'Guests of every age and background are welcome.',
      'I stay calm, patient and professional with your vendors.',
      'I give back to the community, on and off the dance floor.',
    ],
  },
] as const

export const WORLDS = [
  {
    t: 'Weddings',
    d: 'Ceremony to last song. Custom playlists, smooth transitions, premium sound and lighting, and zero stress for you.',
    cta: 'Explore Weddings',
    to: LINKS.weddings,
    big: true,
    img: PHOTOS.stack,
  },
  {
    t: 'Private Events',
    d: 'Milestone birthdays, anniversaries, retirement parties and backyard bashes. I build the set around your people and scale the sound and lighting to fit the space.',
    img: PHOTOS.mixer,
  },
  {
    t: 'Community & Charity',
    d: 'Fundraisers and community events are close to my heart. I’m proud to support Tillsonburg Running With The Bulls, a race that raises money for families affected by cancer. Good music helps good causes bring people together.',
    ext: {
      l: 'See Running With The Bulls',
      h: LINKS.bulls,
    },
    img: PHOTOS.phones,
  },
  {
    t: 'Club & Corporate',
    d: 'I bring club-level energy to nightlife events and a polished, professional touch to company parties, holiday celebrations and team nights. Whether the room needs a packed dance floor or easy background music, I match the mood and keep everyone having a good time.',
    img: PHOTOS.beam,
  },
] as const

export const STEPS = [
  [
    'Say hello',
    'Send your date and a few details. I reply personally within one business day.',
  ],
  [
    'Get to know you',
    'A relaxed call about your people, your vibe and what a perfect night looks like to you.',
  ],
  [
    'Plan it properly',
    'Music brief, timeline, mic cues and lighting, all confirmed in writing.',
  ],
  [
    'Show up early',
    'I arrive early, set up, and run a sound check before guests arrive.',
  ],
  [
    'Run the night',
    'You celebrate. I handle every transition, announcement and surprise.',
  ],
  [
    'Check in after',
    'I follow up, because I want to know how it felt. Your feedback shapes the next night.',
  ],
] as const

// TODO: replace with real Instagram posts or a feed embed.
/** Posts from @DJ_PIPERP. Tall story posts keep their caption at the bottom in view. */
export const INSTAGRAM_POSTS = [
  { src: '/photos/insta/ring-record-card.webp', position: '50% 50%' },
  { src: '/photos/insta/setup-matters.webp', position: '50% 50%' },
  { src: '/photos/insta/this-is-the-job.webp', position: '50% 100%' },
  { src: '/photos/insta/ceremonies-covered.webp', position: '50% 100%' },
  { src: '/photos/insta/golden-hour.webp', position: '50% 50%' },
  { src: '/photos/insta/the-twirl.webp', position: '50% 100%' },
  { src: '/photos/insta/behind-the-music.webp', position: '50% 50%' },
  { src: '/photos/insta/garden-ceremonies.webp', position: '50% 50%' },
  { src: '/photos/insta/peak-party.webp', position: '50% 100%' },
]

/** Venues Piper has played. Real ones only: no addresses, no links. */
export const VENUES_PLAYED = [
  'River’s Edge at the Arlington (Paris)',
  'Brantford Golf & Country Club (Brantford)',
  'Polish Hall (Brantford)',
  'Embee Gardens',
] as const

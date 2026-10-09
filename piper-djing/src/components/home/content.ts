export const PHOTOS = {
  mixer: '/photos/brand/brand-mixer.jpg',
  phones: '/photos/brand/brand-phones.jpg',
  beam: '/photos/brand/brand-beam.jpg',
  stack: '/photos/brand/brand-stack.jpg',
}

/** Set this to a portrait path to replace the labeled placeholder. */
export const PORTRAIT_SRC = ''

/** Sample review and Instagram notes stay hidden until real content replaces them. */
export const SHOW_PLACEHOLDER_NOTES = false as boolean

export const LINKS = {
  weddings: '/weddings',
  book: '/book',
  review: 'https://g.page/r/CZeXBF6gallvEAI/review',
  insta: 'https://www.instagram.com/dj_piperp',
  email: 'PiperPWeddingDJ@gmail.com',
  bulls: 'https://www.facebook.com/share/1CHxV2PubR/',
} as const

export const NAV = [
  { label: 'About', href: '#about' },
  { label: 'Promise', href: '#promise' },
  { label: 'Events', href: '#events' },
  { label: 'Process', href: '#process' },
  { label: 'Reviews', href: '#reviews' },
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
    'I arrive early, set up, run a sound check and coordinate with your venue and team.',
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

// TODO: replace with real Google reviews.
export const REVIEWS = [
  'Our dance floor was full from the first song to the last. Piper read the room, kept the grandparents and the college friends happy, and never once made an awkward announcement.',
  'Zero stress. We handed over our lists and the night just flowed. Piper was easy to talk to, quick to reply and incredibly organized.',
  'Every transition was smooth, the sound was crisp at the back of the hall, and guests are still asking who our DJ was.',
]

// TODO: replace with real Instagram posts or a feed embed.
export const INSTAGRAM_POSTS = [
  PHOTOS.stack,
  PHOTOS.beam,
  PHOTOS.mixer,
  PHOTOS.phones,
]

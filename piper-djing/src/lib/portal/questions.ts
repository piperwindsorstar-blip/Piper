import { TIMELINE } from '../crm/planning.ts'
import type { Planning, SongItem } from '../crm/planning.ts'

export type SectionId = 'details' | 'music' | 'appearance' | 'timeline'

export type QuestionType =
  | 'text'
  | 'textarea'
  | 'number'
  | 'date'
  | 'email'
  | 'phone'
  | 'url'
  | 'choice'
  | 'chips'
  | 'song'
  | 'list'

export type ChoiceOption = { value: string; hint: string }

export type Question = {
  id: string
  section: SectionId
  subsection: string
  group: string
  type: QuestionType
  label: string
  helper?: string
  rail: string
  options?: ChoiceOption[]
  chips?: string[]
  djNote?: string
  djReplies?: Record<string, string>
  timelineIndex?: number
}

const YES_NOT_SURE: ChoiceOption[] = [
  { value: 'Yes', hint: "It's booked" },
  { value: 'Not yet', hint: "I'll ask" },
  { value: 'Not sure', hint: 'Can you check?' },
]

const GENRE_CHIPS = [
  'Throwbacks',
  'Country',
  'Top 40',
  'R&B',
  'Motown',
  'Rock',
  'Latin',
  'Hip hop',
  'Chill dinner',
  'Full party',
]

const DETAIL_QUESTIONS: Question[] = [
  {
    id: 'weddingDate',
    section: 'details',
    subsection: 'The basics',
    group: 'The basics',
    type: 'date',
    label: 'When is the wedding?',
    rail: 'Date of wedding',
  },
  {
    id: 'coupleNames',
    section: 'details',
    subsection: 'The basics',
    group: 'The basics',
    type: 'text',
    label: 'What names should I use?',
    helper: 'The names you want said out loud.',
    rail: "Couple's names",
  },
  {
    id: 'lastName',
    section: 'details',
    subsection: 'The basics',
    group: 'The basics',
    type: 'text',
    label: 'What last name should I use for introductions?',
    helper: 'For introductions.',
    rail: 'Last name',
  },
  {
    id: 'email',
    section: 'details',
    subsection: 'The basics',
    group: 'The basics',
    type: 'email',
    label: 'What email should I use?',
    rail: 'Email',
  },
  {
    id: 'phone',
    section: 'details',
    subsection: 'The basics',
    group: 'The basics',
    type: 'phone',
    label: 'What phone number should I use?',
    rail: 'Phone',
  },
  {
    id: 'guestCount',
    section: 'details',
    subsection: 'The basics',
    group: 'The basics',
    type: 'number',
    label: 'How many guests are you expecting?',
    rail: 'Guest count',
  },
  {
    id: 'venueName',
    section: 'details',
    subsection: 'Venue',
    group: 'Venue',
    type: 'text',
    label: 'What is the venue called?',
    rail: 'Venue name',
  },
  {
    id: 'venuePhone',
    section: 'details',
    subsection: 'Venue',
    group: 'Venue',
    type: 'phone',
    label: 'What is the venue phone number?',
    rail: 'Venue phone',
  },
  {
    id: 'ceremonyAddress',
    section: 'details',
    subsection: 'Venue',
    group: 'Venue',
    type: 'textarea',
    label: 'What is the ceremony address?',
    rail: 'Ceremony address',
  },
  {
    id: 'receptionAddress',
    section: 'details',
    subsection: 'Venue',
    group: 'Venue',
    type: 'textarea',
    label: 'What is the reception address?',
    helper: 'If it is different from the ceremony.',
    rail: 'Reception address',
  },
  {
    id: 'plannerEmail',
    section: 'details',
    subsection: 'Venue',
    group: 'Venue',
    type: 'email',
    label: 'What is your planner or coordinator email?',
    rail: 'Planner',
  },
  {
    id: 'bridesmaids',
    section: 'details',
    subsection: 'Wedding party',
    group: 'Wedding party',
    type: 'number',
    label: 'How many bridesmaids?',
    rail: 'Bridesmaids',
  },
  {
    id: 'groomsmen',
    section: 'details',
    subsection: 'Wedding party',
    group: 'Wedding party',
    type: 'number',
    label: 'How many groomsmen?',
    rail: 'Groomsmen',
  },
  {
    id: 'mc',
    section: 'details',
    subsection: 'Wedding party',
    group: 'Wedding party',
    type: 'text',
    label: 'Who is your MC?',
    djNote:
      "Every night needs a great voice on the mic. I'll reach out before the wedding to sync on names and announcements.",
    rail: 'MC',
  },
  {
    id: 'mcContact',
    section: 'details',
    subsection: 'Wedding party',
    group: 'Wedding party',
    type: 'text',
    label: 'How do I reach your MC?',
    helper: 'A phone number or email is plenty.',
    rail: 'MC contact',
  },
  {
    id: 'tableForDj',
    section: 'details',
    subsection: 'DJ setup',
    group: 'DJ setup',
    type: 'choice',
    label: 'Have you reserved a 6 ft table for me?',
    options: YES_NOT_SURE,
    rail: '6 ft table',
  },
  {
    id: 'spaceForDj',
    section: 'details',
    subsection: 'DJ setup',
    group: 'DJ setup',
    type: 'choice',
    label: "Have you reserved a 10' × 10' space for me?",
    helper:
      'I need that much room for the booth and speakers. Check with your venue.',
    options: YES_NOT_SURE,
    djReplies: {
      'Not sure':
        "No worries. I'll reach out to your venue coordinator and sort it out.",
    },
    rail: "10' × 10' space",
  },
  {
    id: 'outside',
    section: 'details',
    subsection: 'DJ setup',
    group: 'DJ setup',
    type: 'choice',
    label: 'Is any part of the day outside?',
    options: [
      { value: 'Yes', hint: 'At least one part' },
      { value: 'No', hint: 'Everything is inside' },
    ],
    rail: 'Any part outside',
  },
  {
    id: 'power',
    section: 'details',
    subsection: 'DJ setup',
    group: 'DJ setup',
    type: 'choice',
    label: 'Does each space have power?',
    options: [
      { value: 'Yes', hint: 'Power is there' },
      { value: 'No', hint: 'Not yet' },
      { value: 'Not sure', hint: 'Can you check?' },
    ],
    rail: 'Power in each space',
  },
  {
    id: 'uplightColours',
    section: 'details',
    subsection: 'DJ setup',
    group: 'DJ setup',
    type: 'text',
    label: 'What uplight colours would you like?',
    helper: 'If you would like them.',
    rail: 'Uplights',
  },
  {
    id: 'photobooth',
    section: 'details',
    subsection: 'DJ setup',
    group: 'DJ setup',
    type: 'text',
    label: 'What are the photobooth hours?',
    helper: 'If you have one.',
    rail: 'Photobooth',
  },
  {
    id: 'requests',
    section: 'details',
    subsection: 'DJ setup',
    group: 'DJ setup',
    type: 'textarea',
    label: 'Anything else I should know?',
    rail: 'Requests & notes',
  },
]

const MUSIC_QUESTIONS: Question[] = [
  {
    id: 'genres',
    section: 'music',
    subsection: 'Your vibe',
    group: 'Your vibe',
    type: 'chips',
    label: "What's the vibe?",
    helper: 'Pick as many as you like, then add anything in your own words.',
    chips: GENRE_CHIPS,
    rail: 'Genres & artists',
  },
  {
    id: 'mood',
    section: 'music',
    subsection: 'Your vibe',
    group: 'Your vibe',
    type: 'textarea',
    label: 'How should the room feel?',
    rail: 'Mood / vibe',
  },
  {
    id: 'guestRequests',
    section: 'music',
    subsection: 'Your vibe',
    group: 'Your vibe',
    type: 'choice',
    label: 'What should I do with guest requests?',
    options: [
      { value: 'Play what fits', hint: 'If it matches the night' },
      { value: 'Our lists only', hint: 'Stick to what we send' },
      { value: 'No requests', hint: 'Please decline them' },
    ],
    rail: 'Guest requests',
  },
  {
    id: 'dedications',
    section: 'music',
    subsection: 'Your vibe',
    group: 'Your vibe',
    type: 'textarea',
    label: 'Any dedications?',
    helper: 'If you want any.',
    rail: 'Dedications',
  },
  {
    id: 'mustPlay',
    section: 'music',
    subsection: 'Lists',
    group: 'Lists',
    type: 'list',
    label: 'What has to play?',
    rail: 'Must play',
  },
  {
    id: 'doNotPlay',
    section: 'music',
    subsection: 'Lists',
    group: 'Lists',
    type: 'list',
    label: 'What should I never play?',
    helper: 'Even if a guest asks.',
    rail: 'Do not play',
  },
  {
    id: 'preCeremony',
    section: 'music',
    subsection: 'Playlists',
    group: 'Playlists',
    type: 'url',
    label: 'Pre-ceremony playlist',
    helper: 'A Spotify, YouTube, Apple Music, or SoundCloud link.',
    rail: 'Pre-ceremony',
  },
  {
    id: 'cocktail',
    section: 'music',
    subsection: 'Playlists',
    group: 'Playlists',
    type: 'url',
    label: 'Cocktail playlist',
    helper: 'A Spotify, YouTube, Apple Music, or SoundCloud link.',
    rail: 'Cocktail',
  },
  {
    id: 'dinner',
    section: 'music',
    subsection: 'Playlists',
    group: 'Playlists',
    type: 'url',
    label: 'Dinner playlist',
    helper: 'A Spotify, YouTube, Apple Music, or SoundCloud link.',
    rail: 'Dinner',
  },
  {
    id: 'dance',
    section: 'music',
    subsection: 'Playlists',
    group: 'Playlists',
    type: 'url',
    label: 'Dance playlist',
    helper: 'A Spotify, YouTube, Apple Music, or SoundCloud link.',
    rail: 'Dance',
  },
  {
    id: 'specialPlaylists',
    section: 'music',
    subsection: 'Playlists',
    group: 'Playlists',
    type: 'textarea',
    label: 'Any special playlists?',
    rail: 'Special playlists',
  },
]

const APPEARANCE_QUESTIONS: Question[] = [
  {
    id: 'appearances',
    section: 'appearance',
    subsection: 'Order of appearance',
    group: 'Order of appearance',
    type: 'list',
    label: 'Who walks, speaks, or dances?',
    helper: 'Spell names the way they should be said out loud.',
    rail: 'Order of appearance',
  },
]

const TIMELINE_QUESTIONS: Question[] = TIMELINE.map((row, index) => ({
  id: `timeline-${index}`,
  section: 'timeline' as const,
  subsection: row.section,
  group: row.section,
  type: 'song' as const,
  label: songTitle(row.activity),
  helper: 'Search for it or paste a YouTube, Spotify or SoundCloud link.',
  rail: row.activity,
  timelineIndex: index,
}))

export const QUESTIONS: Question[] = [
  ...DETAIL_QUESTIONS,
  ...MUSIC_QUESTIONS,
  ...APPEARANCE_QUESTIONS,
  ...TIMELINE_QUESTIONS,
]

export const SECTION_ORDER: SectionId[] = [
  'details',
  'music',
  'appearance',
  'timeline',
]

export const SECTION_LABEL: Record<SectionId, string> = {
  details: 'Event details',
  music: 'Music',
  appearance: 'Order of appearance',
  timeline: 'Timeline',
}

export function sectionPath(
  section: SectionId,
):
  | '/portal/details'
  | '/portal/music'
  | '/portal/appearance'
  | '/portal/timeline' {
  if (section === 'details') return '/portal/details'
  if (section === 'music') return '/portal/music'
  if (section === 'appearance') return '/portal/appearance'
  return '/portal/timeline'
}

export function questionSearch(search: Record<string, unknown>): {
  q?: string
} {
  if (typeof search.q !== 'string') return {}
  const q = search.q.trim()
  if (!q || q.length > 80) return {}
  return { q }
}

export function timelineQuestions(planning: Planning): Question[] {
  return planning.timeline.map((row, index) => ({
    id: `timeline-${index}`,
    section: 'timeline' as const,
    subsection: row.section,
    group: row.section,
    type: 'song' as const,
    label: songTitle(row.label.trim() || row.activity),
    helper: 'Search for it or paste a YouTube, Spotify or SoundCloud link.',
    rail: row.label.trim() || row.activity,
    timelineIndex: index,
  }))
}

export function sectionQuestions(
  planning: Planning,
  section: SectionId,
): Question[] {
  if (section === 'timeline') return timelineQuestions(planning)
  return QUESTIONS.filter((question) => question.section === section)
}

export function allQuestions(planning: Planning): Question[] {
  return [
    ...sectionQuestions(planning, 'details'),
    ...sectionQuestions(planning, 'music'),
    ...sectionQuestions(planning, 'appearance'),
    ...sectionQuestions(planning, 'timeline'),
  ]
}

export function questionById(id: string): Question | undefined {
  return QUESTIONS.find((question) => question.id === id)
}

export function songTitle(activity: string): string {
  const lower = activity.toLowerCase()
  if (lower.includes('first dance')) return 'Your first dance song'
  if (lower.includes('dinner')) return 'Dinner music'
  if (lower.includes('cocktail')) return 'Cocktail hour music'
  return activity
}

export function songsOf(items: SongItem[], legacy: string): SongItem[] {
  if (items.some((item) => item.song || item.artist || item.link)) return items
  if (!legacy.trim()) return []
  return [{ song: legacy.trim(), artist: '', link: '' }]
}

export function textValue(planning: Planning, id: string): string {
  switch (id) {
    case 'weddingDate':
      return planning.weddingDate
    case 'coupleNames':
      return planning.coupleNames
    case 'lastName':
      return planning.lastName
    case 'email':
      return planning.email
    case 'phone':
      return planning.phone
    case 'guestCount':
      return planning.guestCount
    case 'venueName':
      return planning.venueName
    case 'venuePhone':
      return planning.venuePhone
    case 'ceremonyAddress':
      return planning.ceremonyAddress
    case 'receptionAddress':
      return planning.receptionAddress
    case 'plannerEmail':
      return planning.plannerEmail
    case 'bridesmaids':
      return planning.bridesmaids
    case 'groomsmen':
      return planning.groomsmen
    case 'mc':
      return planning.mc
    case 'mcContact':
      return planning.mcContact
    case 'tableForDj':
      return planning.tableForDj
    case 'spaceForDj':
      return planning.spaceForDj
    case 'outside':
      return planning.outside
    case 'power':
      return planning.power
    case 'uplightColours':
      return planning.uplightColours
    case 'photobooth':
      return planning.photobooth
    case 'requests':
      return planning.requests
    case 'mood':
      return planning.mood
    case 'guestRequests':
      return planning.guestRequests
    case 'dedications':
      return planning.dedications
    case 'preCeremony':
      return planning.preCeremony
    case 'cocktail':
      return planning.cocktail
    case 'dinner':
      return planning.dinner
    case 'dance':
      return planning.dance
    case 'specialPlaylists':
      return planning.specialPlaylists
    case 'genres':
      return planning.genres
    default:
      return ''
  }
}

export function itemAt<TItem>(
  items: readonly TItem[],
  index: number,
): TItem | undefined {
  if (index < 0 || index >= items.length) return undefined
  return items[index]
}

export function momentLabel(planning: Planning, index: number): string {
  const row = itemAt(planning.timeline, index)
  if (!row) return ''
  return row.label.trim() || row.activity
}

export function isVisible(planning: Planning, question: Question): boolean {
  if (question.timelineIndex === undefined) return true
  const row = itemAt(planning.timeline, question.timelineIndex)
  return row?.hidden !== true
}

export function linkPlatform(value: string): string {
  const link = value.trim()
  if (!link) return ''
  if (/spotify\.com/i.test(link)) return 'Spotify'
  if (/youtu\.?be|youtube\.com/i.test(link)) return 'YouTube'
  if (/music\.apple\.com|apple\.com\/.*music/i.test(link)) return 'Apple Music'
  if (/soundcloud\.com/i.test(link)) return 'SoundCloud'
  return ''
}

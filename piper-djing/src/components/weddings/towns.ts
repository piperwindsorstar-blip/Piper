import { FAQ } from './content.ts'

/**
 * One page per town Piper serves outside Brantford, so a couple searching
 * "wedding DJ Hamilton" finds a page about Hamilton. Every claim here is
 * true of the business: distances are approximate driving distances from
 * Brantford, the travel bands are the ones in the terms, and venues named
 * are ones on Piper's own book.
 */
export type TownPath =
  | '/hamilton-wedding-dj'
  | '/cambridge-wedding-dj'
  | '/paris-wedding-dj'

export type Town = {
  path: TownPath
  name: string
  title: string
  description: string
  intro: string
  body: string[]
  travel: string
  faq: (readonly [string, string])[]
}

/** The general questions every town page also answers (not the travel one). */
const SHARED_FAQ = FAQ.filter(([question]) => !/travel/i.test(question))

function townFaq(name: string, travel: string): (readonly [string, string])[] {
  return [[`Do you charge travel to ${name}?`, travel], ...SHARED_FAQ]
}

const HAMILTON_TRAVEL =
  'Piper is based in Brantford, about 40 km from downtown Hamilton. Travel is the one-way driving distance from Brantford: under 50 km is included, and 50 to 100 km is $110. Put your venue address in the booking form and it works out the exact fee.'

const CAMBRIDGE_TRAVEL =
  'Piper is based in Brantford, about 40 km from Cambridge. Travel is the one-way driving distance from Brantford: under 50 km is included, and 50 to 100 km is $110. Put your venue address in the booking form and it works out the exact fee.'

const PARIS_TRAVEL =
  'Paris is about 15 km from Piper’s home base in Brantford, well under 50 km, so travel is included.'

export const TOWNS: Record<TownPath, Town> = {
  '/hamilton-wedding-dj': {
    path: '/hamilton-wedding-dj',
    name: 'Hamilton',
    title: 'Hamilton wedding DJ | DJ Piper P',
    description:
      'Wedding DJ for Hamilton couples. Custom playlists, dancefloor lighting and a real planning meeting from DJ Piper P, just down the 403 in Brantford.',
    intro:
      'Big energy and a plan for everything, for Hamilton couples who want a packed dance floor and a night that runs on time. Check your date in 30 seconds.',
    body: [
      'Hamilton weddings run from downtown halls and golf clubs to estates on the escarpment and barns past the edge of the city. Piper plans every one the same way: at least one planning meeting, your must-play and do-not-play lists, and a timeline confirmed in writing before the day.',
      'On the night, Piper arrives early, sets up and sound checks before guests walk in, and works with your venue and planner so every entrance, speech and first dance lands when it should. The Main Event and The After Party include dancefloor lighting and light MC duties.',
    ],
    travel: HAMILTON_TRAVEL,
    faq: townFaq('Hamilton', HAMILTON_TRAVEL),
  },
  '/cambridge-wedding-dj': {
    path: '/cambridge-wedding-dj',
    name: 'Cambridge',
    title: 'Cambridge wedding DJ | DJ Piper P',
    description:
      'Wedding DJ for Cambridge couples, from Galt to Hespeler. Custom playlists, dancefloor lighting and a real planning meeting from DJ Piper P.',
    intro:
      'A DJ who reads the room and cares how your night feels, for Cambridge couples from Galt to Hespeler. Check your date in 30 seconds.',
    body: [
      'Cambridge weddings happen everywhere from riverside spots along the Grand to halls in Preston and Hespeler and farms just outside town. Piper already has a wedding booked at The Lavender Farm in nearby Ayr.',
      'Every wedding starts with at least one planning meeting, so the music fits your crowd and your story. On the day, Piper sets up early, coordinates with your venue and planner, and keeps the floor full from the first dance to the last song.',
    ],
    travel: CAMBRIDGE_TRAVEL,
    faq: townFaq('Cambridge', CAMBRIDGE_TRAVEL),
  },
  '/paris-wedding-dj': {
    path: '/paris-wedding-dj',
    name: 'Paris',
    title: 'Paris, Ontario wedding DJ | DJ Piper P',
    description:
      'Wedding DJ for Paris, Ontario couples, 15 minutes from Brantford. Custom playlists, dancefloor lighting and travel included, from DJ Piper P.',
    intro:
      'Paris is right up the Grand River from Piper’s home in Brantford, so travel is included. Check your date in 30 seconds.',
    body: [
      'Paris is one of the busiest wedding towns in Brant County, with riverside venues in town and barns and farms all around it. Piper has several weddings booked at Rivers Edge on the Grand.',
      'Every wedding starts with at least one planning meeting and a timeline confirmed in writing. On the day, Piper arrives early, sound checks before guests walk in, and handles every transition so you can enjoy the night.',
    ],
    travel: PARIS_TRAVEL,
    faq: townFaq('Paris', PARIS_TRAVEL),
  },
}

export const TOWN_LIST: Town[] = Object.values(TOWNS)

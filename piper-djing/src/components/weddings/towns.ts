import { TRAVEL_NEAR_CENTS } from '../../lib/piper/rules.ts'
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
  | '/woodstock-wedding-dj'
  | '/burlington-wedding-dj'
  | '/guelph-wedding-dj'
  | '/oakville-wedding-dj'

export type Town = {
  path: TownPath
  name: string
  title: string
  description: string
  intro: string
  body: string[]
  travel: string
  /** A short section near the top, written only for this town. */
  nearby?: string
  /** A venue line under the town section, only for venues Piper has played. */
  venueLine?: string
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

/** The 50 to 100 km fee, from the terms. */
const NEAR_FEE = `$${TRAVEL_NEAR_CENTS / 100}`

/** The same description shape for the newer town pages. */
function townDescription(name: string): string {
  return `${name} wedding DJ Piper P, based in Brantford. Ceremony, reception and full-day wedding packages with clear pricing. Check if your date is open.`
}

const WOODSTOCK_TRAVEL =
  `Woodstock is about 46 km from Piper’s home base in Brantford, so for most Woodstock weddings travel is included. Venues past 50 km are ${NEAR_FEE}, and the booking form works out the exact fee from your venue address.`

const BURLINGTON_TRAVEL =
  `Burlington is about 56 km from Brantford, which puts it in the 50 to 100 km travel band: ${NEAR_FEE}, one flat fee. The booking form confirms it from your venue address.`

const GUELPH_TRAVEL =
  `Guelph is about 54 km from Brantford, so travel is ${NEAR_FEE} (the 50 to 100 km band). Add your venue address in the booking form for the exact figure.`

const OAKVILLE_TRAVEL =
  `Oakville is about 72 km from Brantford along the 403, inside the 50 to 100 km band, so travel is a flat ${NEAR_FEE}. The booking form checks your exact venue address.`

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
      'Hamilton weddings run from downtown halls and golf clubs to estates on the escarpment and barns past the edge of the city. Piper plans every one the same way: one planning meeting, your must-play and do-not-play lists, and a timeline confirmed in writing before the day.',
      'On the night, Piper arrives early, sets up and sound checks before guests walk in, and keeps every entrance, speech and first dance on cue. The Main Event and The After Party include dancefloor lighting and light MC duties.',
    ],
    travel: HAMILTON_TRAVEL,
    nearby:
      'Downtown Hamilton is about 40 km from Piper’s home in Brantford, so travel is included for most Hamilton weddings, and venues past 50 km on the east side are $110. Hamilton couples tend to celebrate in city venues and banquet halls, with a few heading up the escarpment or out to the countryside.',
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
      'Cambridge weddings happen everywhere from riverside spots along the Grand to halls in Preston and Hespeler and farms just outside town.',
      'Every wedding starts with one planning meeting, so the music fits your crowd and your story. On the day, Piper sets up early, sound checks before guests arrive, and keeps the floor full from the first dance to the last song.',
    ],
    travel: CAMBRIDGE_TRAVEL,
    nearby:
      'Cambridge is a quick 30 to 40 km drive from Brantford depending on the part of town, well under 50 km, so travel is included. Weddings around Cambridge lean toward riverside settings on the Grand and rustic barns on the farms just outside the city.',
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
      'Paris is one of the busiest wedding towns in Brant County, with riverside venues in town and barns and farms all around it.',
      'Every wedding starts with one planning meeting and a timeline confirmed in writing. On the day, Piper arrives early, sound checks before guests walk in, and handles every transition so you can enjoy the night.',
    ],
    travel: PARIS_TRAVEL,
    nearby:
      'Paris is only about 15 km from Brantford, so there’s no travel charge at all. Weddings here have a small-town feel, often along the Grand River, with family and friends who all seem to know each other.',
    venueLine:
      'I’ve DJ’d weddings at River’s Edge at the Arlington, right on the Grand River in Paris, so I know the room, the load-in and how the night flows there.',
    faq: townFaq('Paris', PARIS_TRAVEL),
  },
  '/woodstock-wedding-dj': {
    path: '/woodstock-wedding-dj',
    name: 'Woodstock',
    title: 'Woodstock wedding DJ | DJ Piper P',
    description: townDescription('Woodstock'),
    intro:
      'Relaxed, well-planned wedding music for Woodstock couples, from a DJ just down the 403. Check your date in 30 seconds.',
    body: [
      'Piper is based in Brantford and travels to Woodstock and the rest of Oxford County for weddings of every size. Your night starts with a planning meeting, so the music suits your families and friends, and the timeline is confirmed in writing well before the day.',
    ],
    travel: WOODSTOCK_TRAVEL,
    nearby:
      `Woodstock is about 46 km from Brantford, so travel is included for most Woodstock weddings, and venues past 50 km are ${NEAR_FEE}. Celebrations here often have a country feel, with barns, farms and halls spread across Oxford County.`,
    faq: townFaq('Woodstock', WOODSTOCK_TRAVEL),
  },
  '/burlington-wedding-dj': {
    path: '/burlington-wedding-dj',
    name: 'Burlington',
    title: 'Burlington wedding DJ | DJ Piper P',
    description: townDescription('Burlington'),
    intro:
      'A full dance floor and a night that stays on schedule, for Burlington couples planning their wedding. Check your date in 30 seconds.',
    body: [
      'From his home base in Brantford, Piper travels to Burlington for ceremonies, receptions and full-day weddings. He learns your story at a planning meeting, builds the music around your must-play list, and keeps every entrance and speech on cue.',
    ],
    travel: BURLINGTON_TRAVEL,
    nearby:
      `Burlington sits about 56 km from Brantford, so travel comes to ${NEAR_FEE}. Couples here tend to choose waterfront and lakeside settings, golf clubs and banquet halls.`,
    faq: townFaq('Burlington', BURLINGTON_TRAVEL),
  },
  '/guelph-wedding-dj': {
    path: '/guelph-wedding-dj',
    name: 'Guelph',
    title: 'Guelph wedding DJ | DJ Piper P',
    description: townDescription('Guelph'),
    intro:
      'Warm, friendly DJing with a real plan behind it, for Guelph couples who want everyone dancing. Check your date in 30 seconds.',
    body: [
      'Piper lives in Brantford and makes the trip up to Guelph for weddings big and small. You get a planning meeting, your own do-not-play list, and a DJ who sets up and sound checks before your first guest arrives.',
    ],
    travel: GUELPH_TRAVEL,
    nearby:
      `From Brantford it’s about 54 km to Guelph, so travel is ${NEAR_FEE}. Guelph weddings mix university-town spots, historic stone buildings and rustic barns just outside the city.`,
    faq: townFaq('Guelph', GUELPH_TRAVEL),
  },
  '/oakville-wedding-dj': {
    path: '/oakville-wedding-dj',
    name: 'Oakville',
    title: 'Oakville wedding DJ | DJ Piper P',
    description: townDescription('Oakville'),
    intro:
      'Polished, personal wedding entertainment for Oakville couples, with clear pricing from the start. Check your date in 30 seconds.',
    body: [
      'Piper is a Brantford-based wedding DJ who travels to Oakville to play ceremonies and receptions. Every booking includes one planning meeting and a written timeline, and on the day he arrives early so the evening flows.',
    ],
    travel: OAKVILLE_TRAVEL,
    nearby:
      `Oakville is about 72 km from Brantford along the 403, so travel is ${NEAR_FEE}. Weddings here lean toward lakeside settings, golf and country clubs, and elegant halls.`,
    faq: townFaq('Oakville', OAKVILLE_TRAVEL),
  },
}

export const TOWN_LIST: Town[] = Object.values(TOWNS)

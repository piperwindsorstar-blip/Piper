const RESOURCES = [
  'leads',
  'bookings',
  'invoices',
  'payments',
  'packages',
  'terms',
  'questions',
  'media',
  'partners',
  'reviews',
  'bots',
  'emails',
  'externals',
  'venues',
  'settings',
  'rsvps',
] as const

export type DeskBotTarget = {
  resource: (typeof RESOURCES)[number]
  id: string | null
}

export function bareBotPath(pathname: string): string {
  return pathname.length > 1 && pathname.endsWith('/')
    ? pathname.slice(0, -1)
    : pathname
}

/** GET /api/bots/v1 is this desk's usage page. Join and glance stay off it. */
export function isDeskUsageRoot(pathname: string): boolean {
  return bareBotPath(pathname) === '/api/bots/v1'
}

export function isDeskGlance(pathname: string): boolean {
  return bareBotPath(pathname) === '/api/bots/v1/glance'
}

export function deskBotTarget(pathname: string): DeskBotTarget | null {
  const bare = bareBotPath(pathname)
  const match = /^\/api\/bots\/v1\/([a-z]+)(?:\/([^/]+))?$/.exec(bare)
  if (!match) return null
  const resource = match[1]
  if (!resource || !(RESOURCES as readonly string[]).includes(resource))
    return null
  return {
    resource: resource as DeskBotTarget['resource'],
    id: match[2] || null,
  }
}

const RSVP_SLUG = '([a-z0-9]+(?:-[a-z0-9]+)*)'
const RSVP_TOKEN = '([A-Za-z0-9_-]+)'

export type RsvpBotAction =
  | { kind: 'emails'; id: string }
  | { kind: 'questions'; id: string }
  | { kind: 'question-reply'; id: string; questionId: string }
  | { kind: 'guests'; id: string }
  | { kind: 'guest'; id: string; guestId: string }

/** Nested RSVP paths. The two-segment desk routes stay on deskBotTarget. */
export function rsvpBotTarget(pathname: string): RsvpBotAction | null {
  const bare = bareBotPath(pathname)
  const emails = new RegExp(`^/api/bots/v1/rsvps/${RSVP_SLUG}/emails$`).exec(
    bare,
  )
  if (emails?.[1]) return { kind: 'emails', id: emails[1] }
  const questions = new RegExp(
    `^/api/bots/v1/rsvps/${RSVP_SLUG}/questions$`,
  ).exec(bare)
  if (questions?.[1]) return { kind: 'questions', id: questions[1] }
  const reply = new RegExp(
    `^/api/bots/v1/rsvps/${RSVP_SLUG}/questions/${RSVP_TOKEN}/reply$`,
  ).exec(bare)
  if (reply?.[1] && reply[2]) {
    return { kind: 'question-reply', id: reply[1], questionId: reply[2] }
  }
  const guests = new RegExp(`^/api/bots/v1/rsvps/${RSVP_SLUG}/guests$`).exec(
    bare,
  )
  if (guests?.[1]) return { kind: 'guests', id: guests[1] }
  const guest = new RegExp(
    `^/api/bots/v1/rsvps/${RSVP_SLUG}/guests/${RSVP_TOKEN}$`,
  ).exec(bare)
  if (guest?.[1] && guest[2]) {
    return { kind: 'guest', id: guest[1], guestId: guest[2] }
  }
  return null
}

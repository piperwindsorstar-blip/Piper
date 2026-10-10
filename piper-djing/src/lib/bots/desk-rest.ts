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
  'settings',
] as const

export type DeskBotTarget = {
  resource: (typeof RESOURCES)[number]
  id: string | null
}

export function deskBotTarget(pathname: string): DeskBotTarget | null {
  const bare =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
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

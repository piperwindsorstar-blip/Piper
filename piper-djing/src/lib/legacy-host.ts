/** The old host must send people to the same path on the custom domain. */
export const LEGACY_HOST = 'piperp-wedding-dj.grok.me'

const PUBLIC_ORIGIN = 'https://piperpweddingdj.services'

/**
 * Bot calls, couple links, and couple pages are not redirected.
 * This worker answers them itself and does not call the old host.
 */
export function staysOnLegacyHost(pathname: string): boolean {
  return (
    pathname === '/api/bots/v1' ||
    pathname.startsWith('/api/bots/v1/') ||
    pathname === '/c' ||
    pathname.startsWith('/c/') ||
    pathname === '/p' ||
    pathname.startsWith('/p/')
  )
}

const WWW_HOST = 'www.piperpweddingdj.services'

/** www goes to the bare domain. */
export function wwwLocation(
  hostname: string,
  pathname: string,
  search: string,
): string | null {
  if (hostname !== WWW_HOST) return null
  return `${PUBLIC_ORIGIN}${pathname}${search}`
}

export function legacyLocation(
  hostname: string,
  pathname: string,
  search: string,
): string | null {
  if (hostname !== LEGACY_HOST) return null
  if (staysOnLegacyHost(pathname)) return null
  return `${PUBLIC_ORIGIN}${pathname}${search}`
}

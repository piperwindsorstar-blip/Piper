import { LEGACY_HOST } from './legacy-host.ts'

/** Kept so old HTML rewrites stay pointed at the host they were written for. Nothing fetches it. */
export const LEGACY_ORIGIN = `https://${LEGACY_HOST}`

export type LegacyAnswer = 'taken' | 'open' | 'unknown'

export type BookAction =
  | { kind: 'pass' }
  | { kind: 'bots' }
  | { kind: 'server-fn'; id: string }
  | { kind: 'couple'; slug: string }
  | { kind: 'invoice'; slug: string }
  | { kind: 'legacy-page' }

let readLegacyDate: (day: string) => Promise<LegacyAnswer> = async () =>
  'unknown'

export function setLegacyDateReader(
  reader: (day: string) => Promise<LegacyAnswer>,
): void {
  readLegacyDate = reader
}

export function askLegacyDate(day: string): Promise<LegacyAnswer> {
  return readLegacyDate(day)
}

export function legacyDateAnswerFromBody(body: string): LegacyAnswer {
  const match = /"k":\["answer"\],"v":\[\{"t":1,"s":"(taken|open)"\}/.exec(body)
  if (!match) return 'unknown'
  return match[1] === 'taken' ? 'taken' : 'open'
}

/** Old scripts and pictures use hashed names this site does not publish. */
export function isLegacyAsset(pathname: string): boolean {
  return (
    pathname.startsWith('/assets/') ||
    pathname.startsWith('/__grok/') ||
    pathname.startsWith('/photos/') ||
    pathname === '/favicon.svg'
  )
}

export function relayMissingAsset(
  response: Response,
  pathname: string,
): boolean {
  if (!isLegacyAsset(pathname)) return false
  if (response.status === 404) return true
  const type = response.headers.get('content-type') ?? ''
  return type.includes('text/html')
}

export function bookPathAction(pathname: string): BookAction {
  if (pathname === '/api/bots/v1' || pathname.startsWith('/api/bots/v1/')) {
    return { kind: 'bots' }
  }
  if (pathname.startsWith('/_serverFn/')) {
    const id = pathname.slice('/_serverFn/'.length).split('/')[0] ?? ''
    if (!id) return { kind: 'pass' }
    return { kind: 'server-fn', id }
  }
  const couple = oneSlug(pathname, '/c/')
  if (couple) return { kind: 'couple', slug: couple }
  const invoice = oneSlug(pathname, '/p/')
  if (invoice) return { kind: 'invoice', slug: invoice }
  if (
    pathname === '/c' ||
    pathname.startsWith('/c/') ||
    pathname === '/p' ||
    pathname.startsWith('/p/')
  ) {
    return { kind: 'legacy-page' }
  }
  return { kind: 'pass' }
}

export function rewriteLegacyHtml(html: string): string {
  return html
    .replaceAll('"/assets/', `"${LEGACY_ORIGIN}/assets/`)
    .replaceAll("'/assets/", `'${LEGACY_ORIGIN}/assets/`)
    .replaceAll('"/__grok/', `"${LEGACY_ORIGIN}/__grok/`)
    .replaceAll("'/__grok/", `'${LEGACY_ORIGIN}/__grok/`)
    .replaceAll('"/favicon.svg"', `"${LEGACY_ORIGIN}/favicon.svg"`)
}

export function rewriteLegacyLocation(
  location: string,
  publicOrigin: string,
): string {
  if (location.startsWith(`${LEGACY_ORIGIN}/`) || location === LEGACY_ORIGIN) {
    return `${publicOrigin}${location.slice(LEGACY_ORIGIN.length)}`
  }
  return location
}

export function rewriteLegacyCookie(cookie: string): string {
  return cookie.replace(/;\s*Domain=[^;]*/gi, '')
}

/**
 * A missing server function becomes a plain 500. One of ours that fails
 * is marked as serialized, and that answer stays here.
 */
export function unknownServerFn(response: Response): boolean {
  if (response.status < 500) return false
  return response.headers.get('x-tss-serialized') !== 'true'
}

function oneSlug(pathname: string, prefix: '/c/' | '/p/'): string | null {
  const bare =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  if (!bare.startsWith(prefix)) return null
  const rest = bare.slice(prefix.length)
  if (!rest || rest.includes('/')) return null
  try {
    return decodeURIComponent(rest)
  } catch {
    return rest
  }
}

import { LEGACY_HOST } from './legacy-host.ts'

/** The old website still holds the bot invites, couple links, and couple pages. */
export const LEGACY_ORIGIN = `https://${LEGACY_HOST}`

const DATE_CHECK_ID = '60f4c1a6a4b82e54ad4c41791aabe592eccc90bd9af40db36e327ad6e6540389'

const BROWSER =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36'

export type LegacyAnswer = 'taken' | 'open' | 'unknown'

export type BookAction =
  | { kind: 'pass' }
  | { kind: 'bots' }
  | { kind: 'server-fn'; id: string }
  | { kind: 'couple'; slug: string }
  | { kind: 'invoice'; slug: string }
  | { kind: 'legacy-page' }

let readLegacyDate: (day: string) => Promise<LegacyAnswer> = fetchLegacyDate

export function setLegacyDateReader(reader: (day: string) => Promise<LegacyAnswer>): void {
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

export function relayMissingAsset(response: Response, pathname: string): boolean {
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

export function rewriteLegacyLocation(location: string, publicOrigin: string): string {
  if (location.startsWith(`${LEGACY_ORIGIN}/`) || location === LEGACY_ORIGIN) {
    return `${publicOrigin}${location.slice(LEGACY_ORIGIN.length)}`
  }
  return location
}

export function rewriteLegacyCookie(cookie: string): string {
  return cookie.replace(/;\s*Domain=[^;]*/gi, '')
}

export async function unknownServerFn(response: Response): Promise<boolean> {
  if (response.status !== 500) return false
  const text = await response.clone().text()
  return text.includes('"unhandled":true')
}

export async function pageIsLocal(action: {
  kind: 'couple' | 'invoice'
  slug: string
}): Promise<boolean> {
  try {
    const store = await import('./crm/store.server.ts')
    if (action.kind === 'couple') return (await store.coupleBySlug(action.slug)) != null
    return (await store.invoiceBySlug(action.slug)) != null
  } catch {
    return false
  }
}

export async function proxyLegacyBook(request: Request): Promise<Response> {
  const incoming = new URL(request.url)
  const target = new URL(`${incoming.pathname}${incoming.search}`, LEGACY_ORIGIN)
  const headers = new Headers()
  for (const name of ['authorization', 'content-type', 'idempotency-key', 'accept', 'x-tsr-serverfn']) {
    const value = request.headers.get(name)
    if (value) headers.set(name, value)
  }
  const cookie = forwardedCookie(request.headers.get('cookie'))
  if (cookie) headers.set('cookie', cookie)
  headers.set('user-agent', BROWSER)
  headers.set('origin', LEGACY_ORIGIN)
  headers.set('referer', `${LEGACY_ORIGIN}/`)
  headers.set('sec-fetch-site', 'same-origin')
  const method = request.method
  const hasBody = method !== 'GET' && method !== 'HEAD'
  try {
    const upstream = await fetch(target, {
      method,
      headers,
      body: hasBody ? await request.arrayBuffer() : undefined,
      redirect: 'manual',
    })
    return relayLegacyResponse(upstream, incoming.origin)
  } catch {
    return new Response('That page did not open.', { status: 502 })
  }
}

async function fetchLegacyDate(day: string): Promise<LegacyAnswer> {
  try {
    const response = await fetch(`${LEGACY_ORIGIN}/_serverFn/${DATE_CHECK_ID}`, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-tsr-serverfn': 'true',
        origin: LEGACY_ORIGIN,
        referer: `${LEGACY_ORIGIN}/`,
        'user-agent': BROWSER,
      },
      body: JSON.stringify({
        t: {
          t: 10,
          i: 0,
          p: {
            k: ['data'],
            v: [{ t: 10, i: 1, p: { k: ['date'], v: [{ t: 1, s: day }], o: 0 }, o: 0 }],
            o: 0,
          },
          f: 127,
          m: [],
        },
      }),
    })
    if (!response.ok) return 'unknown'
    return legacyDateAnswerFromBody(await response.text())
  } catch {
    return 'unknown'
  }
}

function oneSlug(pathname: string, prefix: '/c/' | '/p/'): string | null {
  const bare = pathname.length > 1 && pathname.endsWith('/') ? pathname.slice(0, -1) : pathname
  if (!bare.startsWith(prefix)) return null
  const rest = bare.slice(prefix.length)
  if (!rest || rest.includes('/')) return null
  try {
    return decodeURIComponent(rest)
  } catch {
    return rest
  }
}

function forwardedCookie(header: string | null): string | null {
  if (!header) return null
  const kept = header
    .split(';')
    .map((part) => part.trim())
    .filter((part) => part && !part.startsWith('piper_desk='))
  return kept.length ? kept.join('; ') : null
}

async function relayLegacyResponse(upstream: Response, publicOrigin: string): Promise<Response> {
  const headers = new Headers()
  const type = upstream.headers.get('content-type') ?? ''
  if (type) headers.set('content-type', type)
  for (const name of [
    'cache-control',
    'x-robots-tag',
    'x-tss-serialized',
    'access-control-allow-origin',
    'access-control-allow-headers',
    'access-control-allow-methods',
  ]) {
    const value = upstream.headers.get(name)
    if (value) headers.set(name, value)
  }
  const location = upstream.headers.get('location')
  if (location) headers.set('location', rewriteLegacyLocation(location, publicOrigin))
  const cookies =
    typeof upstream.headers.getSetCookie === 'function' ? upstream.headers.getSetCookie() : []
  for (const cookie of cookies) headers.append('set-cookie', rewriteLegacyCookie(cookie))
  const html = type.includes('text/html')
  const body = html ? rewriteLegacyHtml(await upstream.text()) : await upstream.arrayBuffer()
  return new Response(body, { status: upstream.status, statusText: upstream.statusText, headers })
}

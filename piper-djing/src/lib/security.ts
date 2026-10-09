const LOCAL_HOSTS = new Set(['localhost', '127.0.0.1', '::1', '[::1]'])

const CSP = [
  "default-src 'self'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "object-src 'none'",
  "script-src 'self' 'unsafe-inline' https://grok.com",
  "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
  "font-src 'self' https://fonts.gstatic.com",
  "img-src 'self' data:",
  "connect-src 'self' https://grok.com https://*.grok.com",
].join('; ')

function clientScheme(request: Request, url: URL): string {
  const visitor = request.headers.get('cf-visitor')
  if (visitor) {
    try {
      const parsed = JSON.parse(visitor) as { scheme?: unknown }
      if (parsed.scheme === 'http' || parsed.scheme === 'https')
        return parsed.scheme
    } catch {
      // A missing visitor header falls through to the forwarded protocol.
    }
  }
  const forwarded = request.headers
    .get('x-forwarded-proto')
    ?.split(',')[0]
    ?.trim()
  if (forwarded === 'http' || forwarded === 'https') return forwarded
  return url.protocol === 'https:' ? 'https' : 'http'
}

/** Send a public http visit to the same address on https. Local dev stays on http. */
export function httpsRedirectTarget(request: Request): string | null {
  const url = new URL(request.url)
  if (LOCAL_HOSTS.has(url.hostname)) return null
  if (clientScheme(request, url) !== 'http') return null
  url.protocol = 'https:'
  return url.toString()
}

export function applySecurityHeaders(
  response: Response,
  request: Request,
): Response {
  const headers = response.headers
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()')
  headers.set('Content-Security-Policy', CSP)
  const host = new URL(request.url).hostname
  const publicHost =
    host === 'piperpweddingdj.services' ||
    host.endsWith('.piperpweddingdj.services') ||
    host.endsWith('.workers.dev')
  if (publicHost) {
    headers.set(
      'Strict-Transport-Security',
      'max-age=31536000; includeSubDomains',
    )
  }
  return response
}

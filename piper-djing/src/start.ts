import { redirect } from '@tanstack/react-router'
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'
import {
  deskBotResponse,
  deskGlanceResponse,
} from './lib/bots/desk-rest.server.ts'
import {
  deskBotTarget,
  isDeskGlance,
  isDeskUsageRoot,
  rsvpBotTarget,
} from './lib/bots/desk-rest.ts'
import { deskUsageResponse } from './lib/bots/usage.server.ts'
import { legacyLocation, wwwLocation } from './lib/legacy-host.ts'
import { applySecurityHeaders, httpsRedirectTarget } from './lib/security.ts'

const legacyHost = createMiddleware().server(async ({ next, request }) => {
  const secure = httpsRedirectTarget(request)
  if (secure) throw redirect({ href: secure, statusCode: 301 })

  const finish = <T extends Response | { response: Response }>(
    outcome: T,
  ): T => {
    const response = outcome instanceof Response ? outcome : outcome.response
    cachePublicPage(response, request)
    applySecurityHeaders(response, request)
    return outcome
  }

  const url = new URL(request.url)
  const www = wwwLocation(url.hostname, url.pathname, url.search)
  if (www) throw redirect({ href: www, statusCode: 301 })
  const target = legacyLocation(url.hostname, url.pathname, url.search)
  if (target) throw redirect({ href: target, statusCode: 301 })

  if (isDeskUsageRoot(url.pathname)) {
    return finish(await deskUsageResponse(request))
  }
  if (isDeskGlance(url.pathname)) {
    return finish(await deskGlanceResponse(request))
  }
  if (deskBotTarget(url.pathname) || rsvpBotTarget(url.pathname)) {
    return finish(await deskBotResponse(request))
  }
  return finish(await next())
})

function cachePublicPage(response: Response, request: Request): void {
  if (request.method !== 'GET' && request.method !== 'HEAD') return
  const path = new URL(request.url).pathname
  if (
    path !== '/' &&
    path !== '/weddings' &&
    path !== '/book' &&
    path !== '/rsvp' &&
    path !== '/rsvp/'
  ) {
    return
  }
  if (response.status !== 200) return
  if (response.headers.has('set-cookie')) return
  response.headers.set('cache-control', 'public, max-age=300')
}

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [legacyHost, csrfMiddleware],
}))

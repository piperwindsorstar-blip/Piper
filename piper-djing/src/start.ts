import { redirect } from '@tanstack/react-router'
import {
  createCsrfMiddleware,
  createMiddleware,
  createStart,
} from '@tanstack/react-start'
import {
  bookPathAction,
  isLegacyAsset,
  pageIsLocal,
  proxyLegacyBook,
  relayMissingAsset,
  unknownServerFn,
} from './lib/legacy-book.server.ts'
import { LEGACY_HOST, legacyLocation } from './lib/legacy-host.ts'
import { applySecurityHeaders, httpsRedirectTarget } from './lib/security.ts'

const legacyHost = createMiddleware().server(async ({ next, request }) => {
  const secure = httpsRedirectTarget(request)
  if (secure) throw redirect({ href: secure, statusCode: 301 })

  const finish = <T extends Response | { response: Response }>(
    outcome: T,
  ): T => {
    const response = outcome instanceof Response ? outcome : outcome.response
    applySecurityHeaders(response, request)
    return outcome
  }

  const url = new URL(request.url)
  const target = legacyLocation(url.hostname, url.pathname, url.search)
  if (target) throw redirect({ href: target, statusCode: 301 })
  if (url.hostname === LEGACY_HOST) return finish(await next())

  const action = bookPathAction(url.pathname)
  if (action.kind === 'pass') {
    if (!isLegacyAsset(url.pathname)) return finish(await next())
    const result = await next()
    if (relayMissingAsset(result.response, url.pathname))
      return finish(await proxyLegacyBook(request))
    return finish(result)
  }
  if (action.kind === 'server-fn') {
    const copy = request.clone()
    try {
      const result = await next()
      if (unknownServerFn(result.response))
        return finish(await proxyLegacyBook(copy))
      return finish(result)
    } catch {
      return finish(await proxyLegacyBook(copy))
    }
  }
  if (
    (action.kind === 'couple' || action.kind === 'invoice') &&
    (await pageIsLocal(action))
  ) {
    return finish(await next())
  }
  return finish(await proxyLegacyBook(request))
})

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [legacyHost, csrfMiddleware],
}))

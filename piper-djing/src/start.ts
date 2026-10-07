import { redirect } from '@tanstack/react-router'
import { createCsrfMiddleware, createMiddleware, createStart } from '@tanstack/react-start'
import {
  bookPathAction,
  isLegacyAsset,
  pageIsLocal,
  proxyLegacyBook,
  relayMissingAsset,
  unknownServerFn,
} from './lib/legacy-book.server.ts'
import { LEGACY_HOST, legacyLocation } from './lib/legacy-host.ts'

const legacyHost = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url)
  const target = legacyLocation(url.hostname, url.pathname, url.search)
  if (target) throw redirect({ href: target, statusCode: 301 })
  if (url.hostname === LEGACY_HOST) return next()

  const action = bookPathAction(url.pathname)
  if (action.kind === 'pass') {
    if (!isLegacyAsset(url.pathname)) return next()
    const result = await next()
    if (relayMissingAsset(result.response, url.pathname)) return proxyLegacyBook(request)
    return result
  }
  if (action.kind === 'server-fn') {
    const copy = request.clone()
    const result = await next()
    if (await unknownServerFn(result.response)) return proxyLegacyBook(copy)
    return result
  }
  if ((action.kind === 'couple' || action.kind === 'invoice') && (await pageIsLocal(action))) {
    return next()
  }
  return proxyLegacyBook(request)
})

const csrfMiddleware = createCsrfMiddleware({
  filter: (ctx) => ctx.handlerType === 'serverFn',
})

export const startInstance = createStart(() => ({
  requestMiddleware: [legacyHost, csrfMiddleware],
}))

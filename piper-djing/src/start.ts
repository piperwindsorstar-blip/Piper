import { redirect } from '@tanstack/react-router'
import { createMiddleware, createStart } from '@tanstack/react-start'
import { legacyLocation } from './lib/legacy-host.ts'

const legacyHost = createMiddleware().server(async ({ next, request }) => {
  const url = new URL(request.url)
  const target = legacyLocation(url.hostname, url.pathname, url.search)
  if (target) throw redirect({ href: target, statusCode: 301 })
  return next()
})

export const startInstance = createStart(() => ({
  requestMiddleware: [legacyHost],
}))

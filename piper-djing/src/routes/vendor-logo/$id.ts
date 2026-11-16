import { createFileRoute } from '@tanstack/react-router'
import { vendorLogo } from '../../lib/crm/vendors.server.ts'

/**
 * A vendor's logo, served from the site's own domain. The page links it with
 * the logo's version, so the browser can keep it while a new upload still
 * shows straight away.
 */
function idFrom(url: string): number {
  const parts = new URL(url).pathname.split('/').filter((part) => part !== '')
  // /vendor-logo/<id>
  return parts.length === 2 ? Number(parts[1]) : 0
}

function bytesFrom(base64: string): Uint8Array {
  const binary = atob(base64)
  const bytes = new Uint8Array(binary.length)
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
  return bytes
}

export const Route = createFileRoute('/vendor-logo/$id')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const id = idFrom(request.url)
        const found = await vendorLogo(id)
        if (!found) return new Response('No logo', { status: 404 })
        const bytes = bytesFrom(found.logo)
        const tag = `"vendor-${id}-${found.version}"`
        const asked = Number(new URL(request.url).searchParams.get('v'))
        const headers: Record<string, string> = {
          'content-type': found.mime,
          'content-length': String(bytes.length),
          'cache-control':
            asked === found.version
              ? 'public, max-age=31536000, immutable'
              : 'public, max-age=60',
          etag: tag,
          'x-content-type-options': 'nosniff',
        }
        if (request.headers.get('if-none-match') === tag) {
          return new Response(null, { status: 304, headers })
        }
        return new Response(bytes.buffer as ArrayBuffer, { status: 200, headers })
      },
    },
  },
})

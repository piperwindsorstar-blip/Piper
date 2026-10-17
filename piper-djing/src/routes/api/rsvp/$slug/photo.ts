import { createFileRoute } from '@tanstack/react-router'
import { readRsvpPhoto } from '../../../../lib/rsvp/store.server.ts'

/**
 * The couple's photo, served from the site's own domain and nothing else.
 *
 * There is exactly one photo per couple: the whole picture they uploaded, at
 * its own proportions. Nothing is ever cropped here, and a `shape` parameter is
 * ignored — a page cached from when the crop tool existed still gets the whole
 * photo rather than a broken image. The version stamp lets the browser keep the
 * image forever while a new upload still shows straight away.
 */
function slugFrom(url: string): string {
  const path = new URL(url).pathname
  const parts = path.split('/').filter((part) => part !== '')
  // /api/rsvp/<slug>/photo
  return parts.length === 4 ? decodeURIComponent(parts[2] ?? '') : ''
}

export const Route = createFileRoute('/api/rsvp/$slug/photo')({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const slug = slugFrom(request.url)
        const found = !slug ? null : await readRsvpPhoto(slug)
        if (!found) return new Response('No photo', { status: 404 })
        const tag = `"${slug}-${found.version}"`
        const headers: Record<string, string> = {
          'content-type': found.mime,
          'content-length': String(found.bytes.length),
          'cache-control': 'public, max-age=31536000, immutable',
          etag: tag,
          'x-content-type-options': 'nosniff',
        }
        if (request.headers.get('if-none-match') === tag) {
          return new Response(null, { status: 304, headers })
        }
        return new Response(found.bytes.buffer as ArrayBuffer, {
          status: 200,
          headers,
        })
      },
    },
  },
})

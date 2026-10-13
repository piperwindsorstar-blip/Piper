import { createFileRoute } from '@tanstack/react-router'
import {
  readRsvpPhoto,
  readRsvpPhotoCrop,
} from '../../../../lib/rsvp/store.server.ts'
import { parsePhotoShape } from '../../../../lib/rsvp/templates.ts'

/**
 * The couple's photo, served from the site's own domain and nothing else.
 *
 * With no `shape`, this is the whole photo exactly as the couple uploaded it —
 * nothing cropped. With a shape, it is the shaped rendition they positioned in
 * the crop tool. The couple's template asks for it with a version stamp, so the
 * browser can keep it forever and a new upload still shows straight away.
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
        const url = new URL(request.url)
        const slug = slugFrom(request.url)
        const shape = parsePhotoShape(url.searchParams.get('shape'))
        const wantsCrop = url.searchParams.has('shape') && shape !== 'full'
        const found = !slug
          ? null
          : wantsCrop
            ? await readRsvpPhotoCrop(slug)
            : await readRsvpPhoto(slug)
        if (!found) return new Response('No photo', { status: 404 })
        const tag = `"${slug}-${shape}-${found.version}"`
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

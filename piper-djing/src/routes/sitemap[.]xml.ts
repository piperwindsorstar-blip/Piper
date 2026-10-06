import { createFileRoute } from '@tanstack/react-router'
import { publicUrl } from '../lib/crm/safe-origin.ts'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${publicUrl('/')}</loc></url>
  <url><loc>${publicUrl('/book')}</loc></url>
</urlset>
`
        return new Response(body, {
          headers: { 'content-type': 'application/xml; charset=utf-8' },
        })
      },
    },
  },
})

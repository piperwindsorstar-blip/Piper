import { createFileRoute } from '@tanstack/react-router'
import { publicUrl } from '../lib/crm/safe-origin.ts'

export const Route = createFileRoute('/sitemap.xml')({
  server: {
    handlers: {
      GET: async () => {
        const body = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
  <url><loc>${publicUrl('/')}</loc></url>
  <url><loc>${publicUrl('/weddings')}</loc></url>
  <url><loc>${publicUrl('/hamilton-wedding-dj')}</loc></url>
  <url><loc>${publicUrl('/cambridge-wedding-dj')}</loc></url>
  <url><loc>${publicUrl('/paris-wedding-dj')}</loc></url>
  <url><loc>${publicUrl('/woodstock-wedding-dj')}</loc></url>
  <url><loc>${publicUrl('/burlington-wedding-dj')}</loc></url>
  <url><loc>${publicUrl('/guelph-wedding-dj')}</loc></url>
  <url><loc>${publicUrl('/oakville-wedding-dj')}</loc></url>
  <url><loc>${publicUrl('/book')}</loc></url>
  <url><loc>${publicUrl('/rsvp')}</loc></url>
  <url><loc>${publicUrl('/contact')}</loc></url>
  <url><loc>${publicUrl('/terms')}</loc></url>
</urlset>
`
        return new Response(body, {
          headers: { 'content-type': 'application/xml; charset=utf-8' },
        })
      },
    },
  },
})

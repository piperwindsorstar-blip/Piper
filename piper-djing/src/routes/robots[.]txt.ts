import { createFileRoute } from '@tanstack/react-router'
import { publicUrl } from '../lib/crm/safe-origin.ts'

export const Route = createFileRoute('/robots.txt')({
  server: {
    handlers: {
      GET: async () => {
        const body = [
          'User-agent: *',
          'Allow: /',
          'Disallow: /desk',
          'Disallow: /login',
          'Disallow: /c/',
          'Disallow: /p/',
          `Sitemap: ${publicUrl('/sitemap.xml')}`,
          '',
        ].join('\n')
        return new Response(body, {
          headers: { 'content-type': 'text/plain; charset=utf-8' },
        })
      },
    },
  },
})

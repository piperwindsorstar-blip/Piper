import { HeadContent, Scripts, createRootRoute, redirect } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { legacyLocation } from '../lib/legacy-host.ts'
import appCss from '../styles.css?url'

const GROK_PROJECT_ID = '01a108f2-ed78-7520-b3dd-a811205b73ee'

export const Route = createRootRoute({
  beforeLoad: async () => {
    if (typeof document !== 'undefined') return
    try {
      const { getRequest } = await import('@tanstack/react-start/server')
      const url = new URL(getRequest().url)
      const target = legacyLocation(url.hostname, url.pathname, url.search)
      if (target) throw redirect({ href: target, statusCode: 301 })
    } catch (error) {
      if (error instanceof Response) throw error
    }
  },
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'apple-mobile-web-app-title', content: 'Piper DJing' },
      { name: 'theme-color', content: '#f4f1ec' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
      { name: 'google-site-verification', content: 'ZMZADdI4jnyoPib3w66dcoUdwQA2BrjskaYXL14Fks4' },
      { name: 'google-site-verification', content: '1Ziqc7uNXcqZec7DG59aKU9SBArgU_ctZpsUYEepYQA' },
      { name: 'grok-project-id', content: GROK_PROJECT_ID },
      { property: 'grok:app_id', content: GROK_PROJECT_ID },
      { title: 'Piper DJing' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      { rel: 'preconnect', href: 'https://fonts.gstatic.com', crossOrigin: 'anonymous' },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600&display=swap',
      },
      { rel: 'manifest', href: '/__grok/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/__grok/icon-180.png' },
    ],
  }),
  shellComponent: RootDocument,
  notFoundComponent: NotFound,
})

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
        <script
          src="https://grok.com/grok-app-builder/extensions.js"
          data-project-id={GROK_PROJECT_ID}
          defer
        />
      </head>
      <body>
        {children}
        <Scripts />
      </body>
    </html>
  )
}

function NotFound() {
  return (
    <main className="mx-auto w-full max-w-6xl px-5 py-24">
      <h1 className="font-display text-4xl tracking-tight">That page is not here.</h1>
      <a className="mt-6 inline-flex text-sm text-muted" href="/">
        Back to Piper DJing
      </a>
    </main>
  )
}

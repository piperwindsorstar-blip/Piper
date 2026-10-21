import { HeadContent, Scripts, createRootRoute } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import appCss from '../styles.css?url'

export const Route = createRootRoute({
  head: () => ({
    meta: [
      { charSet: 'utf-8' },
      { name: 'viewport', content: 'width=device-width, initial-scale=1' },
      { name: 'apple-mobile-web-app-title', content: 'DJ Piper P' },
      { name: 'theme-color', content: '#f4f1ec' },
      { name: 'apple-mobile-web-app-status-bar-style', content: 'black' },
      {
        name: 'google-site-verification',
        content: 'rC-19iyENoGxBTVddW7hMLMplqxu6KsJtb64zruLGWY',
      },
      { title: 'DJ Piper P' },
    ],
    links: [
      { rel: 'stylesheet', href: appCss },
      { rel: 'icon', type: 'image/svg+xml', href: '/favicon.svg' },
      { rel: 'preconnect', href: 'https://fonts.googleapis.com' },
      {
        rel: 'preconnect',
        href: 'https://fonts.gstatic.com',
        crossOrigin: 'anonymous',
      },
      {
        rel: 'stylesheet',
        href: 'https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,500;9..144,600&family=Outfit:wght@400;500;600;700;800&display=swap',
      },
      { rel: 'manifest', href: '/manifest.webmanifest' },
      { rel: 'apple-touch-icon', href: '/icons/icon-180.png' },
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
      <h1 className="font-display text-4xl tracking-tight">
        That page is not here.
      </h1>
      <a className="mt-6 inline-flex text-sm text-muted" href="/">
        Back to DJ Piper P
      </a>
    </main>
  )
}

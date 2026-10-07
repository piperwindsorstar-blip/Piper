import { fileURLToPath } from 'node:url'
import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const GROK_PROJECT_ID = '01a108f2-ed78-7520-b3dd-a811205b73ee'
const cloudflareBuild = process.env.NITRO_PRESET === 'cloudflare_module'

function grokPwaPlugin(): Plugin {
  const tags = [
    '<link rel="manifest" href="/__grok/manifest.webmanifest">',
    '<link rel="apple-touch-icon" href="/__grok/icon-180.png">',
    `<meta name="grok-project-id" content="${GROK_PROJECT_ID}">`,
    `<meta property="grok:app_id" content="${GROK_PROJECT_ID}">`,
    `<script src="https://grok.com/grok-app-builder/extensions.js" data-project-id="${GROK_PROJECT_ID}" defer></script>`,
  ].join('')
  return {
    name: 'grok-pwa',
    transformIndexHtml(html) {
      if (html.includes('grok-project-id')) return html
      return html.replace('</head>', `${tags}</head>`)
    },
  }
}

const config = defineConfig({
  resolve: {
    tsconfigPaths: true,
    alias: cloudflareBuild
      ? [
          {
            find: '@electric-sql/pglite',
            replacement: fileURLToPath(
              new URL('./src/lib/pglite-stub.ts', import.meta.url),
            ),
          },
        ]
      : [],
  },
  server: {
    allowedHosts: ['.trycloudflare.com'],
  },
  plugins: [
    devtools(),
    grokPwaPlugin(),
    nitro({
      ...(cloudflareBuild
        ? {
            preset: 'cloudflare_module' as const,
            compatibilityDate: '2026-10-07',
            cloudflare: {
              deployConfig: true,
              nodeCompat: true,
              wrangler: {
                name: 'piper-djing',
                workers_dev: true,
                durable_objects: {
                  bindings: [{ name: 'BOOK', class_name: 'Book' }],
                },
                migrations: [{ tag: 'v1', new_sqlite_classes: ['Book'] }],
              },
            },
          }
        : {}),
      rollupConfig: {
        external: [/^@sentry\//, 'pg'],
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config

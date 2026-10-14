import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const cloudflareBuild = process.env.NITRO_PRESET === 'cloudflare_module'

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
  ssr: {
    external: ['cloudflare:sockets'],
  },
  build: {
    rolldownOptions: {
      output: {
        // Keep circular client chunks from calling an export before it exists.
        strictExecutionOrder: true,
      },
    },
  },
  plugins: [
    devtools(),
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
        external: [/^@sentry\//, 'pg', 'cloudflare:sockets'],
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config

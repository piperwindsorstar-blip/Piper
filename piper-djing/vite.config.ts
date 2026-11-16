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
      // Daily jobs live in server/tasks. On Cloudflare the schedule becomes a
      // Cron Trigger at build time. 12:13 UTC is 8:13 AM in Toronto (7:13 in
      // winter).
      serverDir: './server',
      experimental: { tasks: true },
      scheduledTasks: { '13 12 * * *': ['rsvp:daily'] },
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
                // Keep variables set in the Cloudflare dashboard on every
                // deploy. Without this, plain-text variables are wiped.
                keep_vars: true,
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

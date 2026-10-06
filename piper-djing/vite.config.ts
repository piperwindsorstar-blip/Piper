import { defineConfig, type Plugin } from 'vite'
import { devtools } from '@tanstack/devtools-vite'

import { tanstackStart } from '@tanstack/react-start/plugin/vite'

import viteReact from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { nitro } from 'nitro/vite'

const GROK_PROJECT_ID = '01a108f2-ed78-7520-b3dd-a811205b73ee'

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
  resolve: { tsconfigPaths: true },
  plugins: [
    devtools(),
    grokPwaPlugin(),
    nitro({
      rollupConfig: {
        external: [/^@sentry\//, '@electric-sql/pglite', 'pg'],
      },
    }),
    tailwindcss(),
    tanstackStart(),
    viteReact(),
  ],
})

export default config

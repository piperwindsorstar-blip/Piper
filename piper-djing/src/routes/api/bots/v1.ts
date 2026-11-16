import { createFileRoute } from '@tanstack/react-router'
import { handleBot } from '../../../lib/bots/handle.server.ts'

export const Route = createFileRoute('/api/bots/v1')({
  server: {
    handlers: {
      GET: async ({ request }) => handleBot(request),
      POST: async ({ request }) => handleBot(request),
    },
  },
})

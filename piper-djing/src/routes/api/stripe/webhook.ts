import { createFileRoute } from '@tanstack/react-router'
import { handleStripeWebhook } from '../../../lib/crm/stripe.server.ts'

export const Route = createFileRoute('/api/stripe/webhook')({
  server: {
    handlers: {
      POST: async ({ request }) => handleStripeWebhook(request),
    },
  },
})

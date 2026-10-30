import { cardStatus } from '../crm/stripe.server.ts'
import { deskProfile } from '../crm/store.server.ts'

/**
 * GET settings for bots: the desk profile plus a read-only payByCard flag
 * (true only when Stripe is set up and "Pay by card" is on).
 */
export async function botSettings() {
  const [profile, card] = await Promise.all([
    deskProfile(),
    cardStatus().catch(() => ({ enabled: false })),
  ])
  return { ...profile, payByCard: card.enabled }
}

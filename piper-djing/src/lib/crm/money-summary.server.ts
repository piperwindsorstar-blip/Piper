import { listRsvpPurchases } from '../rsvp/purchase.server.ts'
import { moneySummary } from './money-summary.ts'
import type { MoneySummary } from './money-summary.ts'
import { listBookings, listPayments } from './store.server.ts'

/** The desk's Money page, read from the book. Shared by the desk and the bots. */
export async function loadMoneySummary(): Promise<MoneySummary> {
  const [bookings, payments, rsvp] = await Promise.all([
    listBookings(),
    listPayments(),
    listRsvpPurchases().catch(() => []),
  ])
  // Every RSVP sale row is a paid Checkout; its outcome says how it was filed.
  return moneySummary(bookings, payments, rsvp)
}

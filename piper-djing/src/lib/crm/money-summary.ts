/**
 * The Money page in one shape: who owes what, and every payment in. The desk
 * page and the bot API both read it, so a bot sees the same numbers Piper does.
 * Pure: no database. All amounts are integer Canadian cents.
 */

export type MoneyBooking = {
  id: number
  slug: string
  partnerOne: string
  partnerTwo: string
  email: string
  eventDate: string
  packageName: string
  status: string
  sample: boolean
  totalCents: number
  invoice: {
    slug: string
    status: string
    totalCents: number
    receivedCents: number
    balanceCents: number
  } | null
}

export type MoneyPayment = {
  id: number
  bookingId: number
  names: string
  cents: number
  note: string
  paidOn: string
  method: string
  hstCents: number
}

export type MoneyRsvpSale = {
  couple: string
  baseCents: number
  hstCents: number
  paidOn: string
  live: boolean
  outcome: string
}

export type OwingCouple = {
  bookingId: number
  names: string
  eventDate: string
  packageName: string
  status: string
  invoiceStatus: string | null
  invoiceSlug: string | null
  totalCents: number
  paidCents: number
  leftCents: number
  /** False when the desk has no email for them: invoices and card links cannot be emailed. */
  hasEmail: boolean
}

export type PaymentIn = MoneyPayment & {
  kind: 'payment' | 'refund'
  /** Card HST collected on top. Never part of a balance. */
  chargedCents: number
}

export type PaymentMonth = {
  /** YYYY-MM */
  month: string
  /** Payments minus refunds in that month, before card HST. */
  netCents: number
  payments: PaymentIn[]
}

export type MoneySummary = {
  totals: {
    /** Agreed totals of every held or booked date (test samples left out). */
    bookedCents: number
    /** What those couples have paid toward their totals. */
    collectedCents: number
    /** What those couples still owe. */
    stillToCollectCents: number
    /** Every payment in, before refunds and HST. */
    receivedCents: number
    refundedCents: number
    /** Card HST on booking payments and RSVP sales. Sits on top; never a balance. */
    cardHstCents: number
    weddings: number
  }
  whoOwes: OwingCouple[]
  paymentsIn: PaymentMonth[]
}

/** A held or booked date that is not a test sample. */
export function onBook(booking: MoneyBooking): boolean {
  return !booking.sample && (booking.status === 'hold' || booking.status === 'booked')
}

export function moneySummary(
  bookings: MoneyBooking[],
  payments: MoneyPayment[],
  rsvpSales: MoneyRsvpSale[] = [],
): MoneySummary {
  const counted = bookings.filter(onBook)
  let bookedCents = 0
  let collectedCents = 0
  let stillToCollectCents = 0
  const whoOwes: OwingCouple[] = []
  for (const booking of counted) {
    const total = booking.invoice?.totalCents ?? booking.totalCents
    const paid = Math.max(0, booking.invoice?.receivedCents ?? 0)
    const left = Math.max(0, booking.invoice ? booking.invoice.balanceCents : total)
    bookedCents += total
    collectedCents += paid
    stillToCollectCents += left
    if (left > 0) {
      whoOwes.push({
        bookingId: booking.id,
        names: `${booking.partnerOne} and ${booking.partnerTwo}`,
        eventDate: booking.eventDate,
        packageName: booking.packageName,
        status: booking.status,
        invoiceStatus: booking.invoice?.status ?? null,
        invoiceSlug: booking.invoice?.slug ?? null,
        totalCents: total,
        paidCents: paid,
        leftCents: left,
        hasEmail: booking.email.trim().length > 0,
      })
    }
  }
  whoOwes.sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.bookingId - b.bookingId)

  const receivedCents = payments.filter((p) => p.cents > 0).reduce((sum, p) => sum + p.cents, 0)
  const refundedCents = payments.filter((p) => p.cents < 0).reduce((sum, p) => sum - p.cents, 0)
  const cardHstCents =
    payments.reduce((sum, p) => sum + (p.cents > 0 ? Math.max(0, p.hstCents) : 0), 0) +
    rsvpSales.reduce((sum, sale) => sum + Math.max(0, sale.hstCents), 0)

  const months = new Map<string, PaymentMonth>()
  const ordered = [...payments].sort(
    (a, b) => b.paidOn.localeCompare(a.paidOn) || b.id - a.id,
  )
  for (const payment of ordered) {
    const month = payment.paidOn.slice(0, 7) || 'undated'
    let group = months.get(month)
    if (!group) {
      group = { month, netCents: 0, payments: [] }
      months.set(month, group)
    }
    group.netCents += payment.cents
    group.payments.push({
      ...payment,
      kind: payment.cents < 0 ? 'refund' : 'payment',
      chargedCents: Math.abs(payment.cents) + (payment.cents > 0 ? Math.max(0, payment.hstCents) : 0),
    })
  }

  return {
    totals: {
      bookedCents,
      collectedCents,
      stillToCollectCents,
      receivedCents,
      refundedCents,
      cardHstCents,
      weddings: counted.length,
    },
    whoOwes,
    paymentsIn: [...months.values()],
  }
}

import { longDate } from './crm/dates.ts'

/** Fields the mixer reads. Pricing stays in the existing quote function. */
export type ConsoleBooking = {
  id: number
  partnerOne: string
  partnerTwo: string
  eventDate: string
  sample: boolean
  status: string
  totalCents: number
  holdLastDay: string | null
  invoice: {
    status: string
    receivedCents: number
    balanceCents: number
  } | null
}

export type ConsoleLead = {
  id: number
  partnerOne: string
  partnerTwo: string
  email: string
  eventDate: string | null
}

export type ConsoleReview = { show: boolean }

export type Led = 'green' | 'amber' | 'pink' | 'off'

export type Meter = { fill: number; led: Led; badge: number }

export type Attention = {
  id: string
  title: string
  detail: string
  to: '/desk/bookings' | '/desk/leads' | '/desk/payments'
}

const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
]

export function daysUntil(today: string, day: string): number {
  const start = Date.parse(`${today}T12:00:00Z`)
  const end = Date.parse(`${day}T12:00:00Z`)
  return Math.round((end - start) / 86_400_000)
}

export function onTheBook(bookings: ConsoleBooking[]): ConsoleBooking[] {
  return bookings.filter(
    (booking) =>
      !booking.sample &&
      (booking.status === 'hold' || booking.status === 'booked'),
  )
}

function counted(bookings: ConsoleBooking[]): ConsoleBooking[] {
  return bookings.filter(
    (booking) =>
      !booking.sample &&
      booking.status !== 'cancelled' &&
      booking.status !== 'released',
  )
}

export function meterSegments(fill: number): boolean[] {
  const lit = Math.round(Math.min(1, Math.max(0, fill)) * 8)
  return Array.from({ length: 8 }, (_, index) => index < lit)
}

export function channelMeter(
  channel: string,
  input: {
    bookings: ConsoleBooking[]
    leads: ConsoleLead[]
    questions: number
    media: number
    partners: number
    reviews: ConsoleReview[]
    bots: number
    totalCents: number
  },
  today: string,
): Meter {
  const none = { fill: 0, led: 'green' as const, badge: 0 }
  if (channel === 'Overview') {
    return {
      fill: onTheBook(input.bookings).length / 8,
      led: 'green',
      badge: 0,
    }
  }
  if (channel === 'Leads') {
    return {
      fill: input.leads.length / 5,
      led: input.leads.length > 0 ? 'pink' : 'green',
      badge: input.leads.length,
    }
  }
  if (channel === 'Bookings') {
    const active = input.bookings.filter(
      (booking) => !booking.sample && booking.status !== 'cancelled',
    )
    const soon = input.bookings.some(
      (booking) =>
        !booking.sample &&
        booking.status === 'hold' &&
        booking.holdLastDay != null &&
        daysUntil(today, booking.holdLastDay) <= 14,
    )
    return { fill: active.length / 8, led: soon ? 'amber' : 'green', badge: 0 }
  }
  if (channel === 'Invoices') {
    const live = input.bookings.filter(
      (booking) => booking.invoice && booking.invoice.status !== 'void',
    )
    const sent = live.filter((booking) => booking.invoice?.status === 'sent')
    const drafts = input.bookings.filter(
      (booking) => !booking.sample && booking.invoice?.status === 'draft',
    )
    return {
      fill: live.length === 0 ? 0 : sent.length / live.length,
      led: drafts.length > 0 ? 'amber' : 'green',
      badge: drafts.length,
    }
  }
  if (channel === 'Payments') {
    const rows = counted(input.bookings)
    const received = rows.reduce(
      (sum, booking) => sum + (booking.invoice?.receivedCents ?? 0),
      0,
    )
    const owing = rows.some(
      (booking) => (booking.invoice?.balanceCents ?? booking.totalCents) > 0,
    )
    return {
      fill: input.totalCents > 0 ? received / input.totalCents : 0,
      led: owing ? 'amber' : 'green',
      badge: 0,
    }
  }
  if (channel === 'Questions') return { ...none, fill: input.questions / 8 }
  if (channel === 'Reviews') {
    const shown = input.reviews.filter((review) => review.show).length
    const hidden = input.reviews.filter((review) => !review.show).length
    return {
      fill: shown / 5,
      led: hidden > 0 ? 'amber' : 'green',
      badge: hidden,
    }
  }
  if (channel === 'Media')
    return { fill: input.media / 5, led: 'green', badge: 0 }
  if (channel === 'Partners') {
    return {
      fill: input.partners / 4,
      led: input.partners > 0 ? 'green' : 'off',
      badge: 0,
    }
  }
  if (channel === 'Bots')
    return { fill: input.bots / 6, led: 'green', badge: 0 }
  if (channel === 'Packages' || channel === 'Terms' || channel === 'Settings') {
    return { fill: 1, led: 'green', badge: 0 }
  }
  return none
}

export function attention(
  bookings: ConsoleBooking[],
  leads: ConsoleLead[],
  today: string,
): Attention[] {
  const items: Attention[] = []
  for (const booking of bookings) {
    if (
      booking.sample ||
      booking.status !== 'open' ||
      booking.invoice?.status !== 'draft'
    ) {
      continue
    }
    items.push({
      id: `draft-${booking.id}`,
      title: `Send the invoice to ${booking.partnerOne} and ${booking.partnerTwo}`,
      detail: 'The date stays open until the invoice is sent.',
      to: '/desk/bookings',
    })
  }
  for (const booking of bookings) {
    if (booking.sample || booking.status !== 'hold' || !booking.holdLastDay)
      continue
    const left = daysUntil(today, booking.holdLastDay)
    items.push({
      id: `hold-${booking.id}`,
      title: `${booking.partnerOne} and ${booking.partnerTwo}: deposit due`,
      detail: `Hold ends ${longDate(booking.holdLastDay)} (${left} days left).`,
      to: '/desk/payments',
    })
  }
  for (const lead of leads) {
    items.push({
      id: `lead-${lead.id}`,
      title: `Answer ${lead.partnerOne} and ${lead.partnerTwo}`,
      detail: lead.email,
      to: '/desk/leads',
    })
  }
  return items
}

export function upcomingMonths(today: string) {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7))
  return Array.from({ length: 24 }, (_, index) => {
    const cursor = month - 1 + index
    const y = year + Math.floor(cursor / 12)
    const m = ((cursor % 12) + 12) % 12
    return {
      key: `${y}-${String(m + 1).padStart(2, '0')}`,
      name: MONTHS[m] ?? '',
      short: (MONTHS[m] ?? '').slice(0, 3),
      year: y,
    }
  })
}

export function monthActivity(
  key: string,
  bookings: ConsoleBooking[],
  leads: ConsoleLead[],
  external: { eventDate: string; released: boolean }[] = [],
) {
  const onDate = (date: string | null | undefined) =>
    Boolean(date && date.startsWith(key))
  return {
    booked:
      bookings.filter(
        (booking) =>
          !booking.sample &&
          booking.status === 'booked' &&
          onDate(booking.eventDate),
      ).length +
      external.filter((row) => !row.released && onDate(row.eventDate)).length,
    held: bookings.filter(
      (booking) =>
        !booking.sample &&
        booking.status === 'hold' &&
        onDate(booking.eventDate),
    ).length,
    lead: leads.filter((lead) => onDate(lead.eventDate)).length,
  }
}

export function bookChartLabel(
  bookings: ConsoleBooking[],
  leads: ConsoleLead[],
  external: { released: boolean }[] = [],
): string {
  const real = bookings.filter((booking) => !booking.sample)
  const booked =
    real.filter((booking) => booking.status === 'booked').length +
    external.filter((row) => !row.released).length
  const held = real.filter((booking) => booking.status === 'hold').length
  return `Weddings per month for the next 24 months. ${booked} booked, ${held} held, ${leads.length} leads. Test samples are excluded.`
}

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  attention,
  bookChartLabel,
  channelMeter,
  daysUntil,
  meterSegments,
  monthActivity,
  onTheBook,
  upcomingMonths,
} from './desk-console.ts'
import type { ConsoleBooking, ConsoleLead } from './desk-console.ts'

const today = '2026-10-09'

function booking(
  patch: Partial<ConsoleBooking> & Pick<ConsoleBooking, 'id'>,
): ConsoleBooking {
  return {
    partnerOne: 'A',
    partnerTwo: 'B',
    eventDate: '2027-06-20',
    sample: false,
    status: 'open',
    totalCents: 165000,
    holdLastDay: null,
    invoice: { status: 'draft', receivedCents: 0, balanceCents: 165000 },
    ...patch,
  }
}

const leads: ConsoleLead[] = [
  {
    id: 1,
    partnerOne: 'Alex',
    partnerTwo: 'Taylor',
    email: 'alex@example.com',
    eventDate: '2027-08-14',
  },
]

describe('desk console meters', () => {
  it('counts held and booked dates and leaves samples off the book', () => {
    const bookings = [
      booking({ id: 1, status: 'booked' }),
      booking({ id: 2, status: 'hold', holdLastDay: '2026-10-20' }),
      booking({ id: 3, status: 'open', sample: true }),
      booking({ id: 4, status: 'cancelled' }),
    ]
    assert.equal(onTheBook(bookings).length, 2)
    assert.match(bookChartLabel(bookings, leads), /1 booked, 1 held, 1 leads/)
    assert.equal(monthActivity('2027-06', bookings, []).booked, 1)
    assert.equal(monthActivity('2028-01', bookings, []).booked, 0)
    assert.equal(
      monthActivity(
        '2028-01',
        bookings,
        [],
        [
          { eventDate: '2028-01-04', released: false },
          { eventDate: '2028-01-05', released: true },
        ],
      ).booked,
      1,
    )
  })

  it('lights a hold that ends within 14 days and badges real drafts', () => {
    const bookings = [
      booking({ id: 1, status: 'hold', holdLastDay: '2026-10-20' }),
      booking({
        id: 2,
        sample: true,
        invoice: { status: 'draft', receivedCents: 0, balanceCents: 1 },
      }),
    ]
    const bookingsMeter = channelMeter('Bookings', blank(bookings), today)
    assert.equal(bookingsMeter.led, 'amber')
    assert.equal(daysUntil(today, '2026-10-23'), 14)
    const later = channelMeter(
      'Bookings',
      blank([booking({ id: 1, status: 'hold', holdLastDay: '2026-11-09' })]),
      today,
    )
    assert.equal(later.led, 'green')
    const invoices = channelMeter('Invoices', blank(bookings), today)
    assert.equal(invoices.badge, 1)
    assert.equal(invoices.led, 'amber')
  })

  it('turns payments amber while a counted booking still has a balance', () => {
    const meter = channelMeter(
      'Payments',
      { ...blank([booking({ id: 1, status: 'booked' })]), totalCents: 165000 },
      today,
    )
    assert.equal(meter.led, 'amber')
    assert.equal(meter.fill, 0)
    const paid = channelMeter(
      'Payments',
      {
        ...blank([
          booking({
            id: 1,
            status: 'booked',
            invoice: { status: 'sent', receivedCents: 165000, balanceCents: 0 },
          }),
        ]),
        totalCents: 165000,
      },
      today,
    )
    assert.equal(paid.led, 'green')
    assert.equal(paid.fill, 1)
  })

  it('greys partners when there are none and fills the fixed channels', () => {
    const empty = channelMeter('Partners', blank([]), today)
    assert.equal(empty.led, 'off')
    const some = channelMeter('Partners', { ...blank([]), partners: 2 }, today)
    assert.equal(some.led, 'green')
    assert.equal(channelMeter('Packages', blank([]), today).fill, 1)
    assert.equal(channelMeter('Leads', { ...blank([]), leads }, today).badge, 1)
    assert.equal(
      channelMeter('Leads', { ...blank([]), leads }, today).led,
      'pink',
    )
    assert.deepEqual(meterSegments(0.5), [
      true,
      true,
      true,
      true,
      false,
      false,
      false,
      false,
    ])
  })

  it('lists drafts, holds, and leads, and skips test samples', () => {
    const items = attention(
      [
        booking({ id: 1, partnerOne: 'Sam', partnerTwo: 'Jordan' }),
        booking({ id: 2, sample: true }),
        booking({
          id: 3,
          partnerOne: 'Casey',
          partnerTwo: 'Drew',
          status: 'hold',
          holdLastDay: '2026-10-30',
        }),
      ],
      leads,
      today,
    )
    assert.deepEqual(
      items.map((item) => item.title),
      [
        'Send the invoice to Sam and Jordan',
        'Casey and Drew: deposit due',
        'Answer Alex and Taylor',
      ],
    )
    assert.equal(items[1]?.detail.includes('21 days left'), true)
  })

  it('starts the chart on the current month', () => {
    const months = upcomingMonths('2026-10-09')
    assert.equal(months.length, 24)
    assert.equal(months[0]?.key, '2026-10')
    assert.equal(months[23]?.key, '2028-09')
  })
})

function blank(bookings: ConsoleBooking[]) {
  return {
    bookings,
    leads: [] as ConsoleLead[],
    questions: 0,
    media: 0,
    partners: 0,
    reviews: [],
    bots: 0,
    totalCents: 0,
  }
}

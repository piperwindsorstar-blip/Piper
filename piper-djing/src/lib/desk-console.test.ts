import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  comingUp,
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

  it('names a one-person event inquiry without a dangling "and"', () => {
    const items = attention(
      [],
      [{ id: 2, partnerOne: 'Jamie Lee', partnerTwo: '', email: 'jamie@example.com', eventDate: '2027-03-09' }],
      today,
    )
    assert.equal(items[0]?.title, 'Answer Jamie Lee')
  })

  it('adds a balance due, a plan behind, and couples with no email', () => {
    const items = attention(
      [
        booking({
          id: 10,
          partnerOne: 'Roxana',
          partnerTwo: 'Ibu',
          status: 'booked',
          eventDate: '2026-10-24',
          email: '',
          invoice: { status: 'sent', receivedCents: 30000, balanceCents: 70000 },
        }),
        booking({
          id: 11,
          status: 'booked',
          eventDate: '2027-06-05',
          email: '',
          invoice: { status: 'sent', receivedCents: 50000, balanceCents: 120000 },
        }),
        booking({ id: 12, status: 'booked', eventDate: '2027-07-01', email: 'a@b.ca' }),
      ],
      [],
      today,
      [
        { bookingId: 10, percent: 10, answered: 5, total: 50 },
        { bookingId: 11, percent: 10, answered: 5, total: 50 },
      ],
    )
    assert.deepEqual(
      items.map((item) => [item.kind, item.title]),
      [
        ['plan', 'Roxana and Ibu have planned 10%'],
        ['balance', 'Roxana and Ibu still owe $700'],
        ['email', '2 couples have no email address'],
      ],
    )
    assert.equal(items[0]?.detail, '5 of 50 answers in, and the wedding is in 15 days.')
    assert.equal(items[0]?.couple, 10)
    assert.equal(items[1]?.to, '/desk/money')
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

describe('coming up checklist', () => {
  const base = {
    id: 7,
    partnerOne: 'Roxana',
    partnerTwo: 'Ibu',
    eventDate: '2026-10-29',
    sample: false,
    status: 'booked',
    totalCents: 100_000,
    holdLastDay: null,
    email: '',
    venueStreet: '97 Grand River St N',
    travelKm: 13.8,
    invoice: { status: 'sent', receivedCents: 30_000, balanceCents: 70_000 },
  } as ConsoleBooking & { venueStreet: string; travelKm: number | null }

  it('lists what is still missing for weddings in the next 30 days', () => {
    const [row] = comingUp(
      [base],
      [{ bookingId: 7, percent: 53, answered: 20, total: 38, arrivalTime: '' }],
      '2026-10-15',
    )
    assert.equal(row.days, 14)
    assert.deepEqual(
      row.items.map((item) => [item.id, item.done]),
      [
        ['plan', false],
        ['email', false],
        ['paid', false],
        ['arrival', false],
        ['venue', true],
      ],
    )
    assert.equal(row.items.find((item) => item.id === 'paid')?.label, '$700 still owing')
    assert.equal(row.open, 4)
  })

  it('skips far-off, past, test and unbooked dates', () => {
    const plans = [{ bookingId: 7, percent: 100, answered: 38, total: 38, arrivalTime: '4 pm' }]
    assert.equal(comingUp([base], plans, '2026-09-01').length, 0)
    assert.equal(comingUp([base], plans, '2026-10-30').length, 0)
    assert.equal(comingUp([{ ...base, sample: true }], plans, '2026-10-15').length, 0)
    assert.equal(comingUp([{ ...base, status: 'hold' }], plans, '2026-10-15').length, 0)
    const done = comingUp(
      [{ ...base, email: 'a@b.co', travelKm: 13.8, invoice: { status: 'sent', receivedCents: 100_000, balanceCents: 0 } }],
      plans,
      '2026-10-15',
    )[0]
    assert.equal(done.open, 0)
  })
})

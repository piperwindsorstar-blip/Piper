import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bookingLetter,
  coupleAddress,
  hasCoupleAddress,
  invoiceLetter,
  paymentLetter,
} from './mail-copy.ts'
import type { LetterBooking } from './mail-copy.ts'

const url = (path: string) => `https://piperpweddingdj.services${path}`

const sample: LetterBooking = {
  partnerOne: 'Mara',
  partnerTwo: 'Quinn',
  eventDate: '2027-11-21',
  stagDate: '2027-10-02',
  packageName: 'Full wedding day',
  withStag: true,
  venueName: 'The Hall',
  venueStreet: '12 Chapel Lane',
  venueTwoName: 'The Barn',
  venueTwoStreet: '4 Mill Road',
  sample: true,
  status: 'hold',
  totalCents: 235000,
  depositCents: 50000,
  slug: 'mara-quinn',
  holdStartedOn: '2026-10-06',
  holdLastDay: '2026-11-04',
  stagReleased: false,
  invoice: {
    slug: 'inv-mara',
    status: 'sent',
    totalCents: 235000,
    depositCents: 50000,
    receivedCents: 0,
    balanceCents: 235000,
  },
}

describe('couple emails', () => {
  it('refuses a booking with no address', () => {
    assert.throws(() => coupleAddress(''), /no email address/)
    assert.throws(() => coupleAddress('not-an-email'), /no email address/)
    assert.equal(coupleAddress('  mara@example.com '), 'mara@example.com')
    assert.equal(hasCoupleAddress(''), false)
    assert.equal(hasCoupleAddress('mara@example.com'), true)
  })

  it('writes a booking letter without streets or the home base', () => {
    const letter = bookingLetter(sample, url)
    assert.match(letter.subject, /^TEST · /)
    assert.match(letter.text, /Mara and Quinn/)
    assert.match(letter.text, /Full wedding day/)
    assert.match(letter.text, /21 November 2027/)
    assert.match(letter.text, /2 October 2027/)
    assert.match(letter.text, /The Hall/)
    assert.match(letter.text, /The Barn/)
    assert.match(letter.text, /\$2,350\.00/)
    assert.match(letter.text, /\$500\.00/)
    assert.match(
      letter.text,
      /https:\/\/piperpweddingdj\.services\/c\/mara-quinn/,
    )
    assert.match(letter.text, /planning form is on that page/)
    assert.match(
      letter.text,
      /https:\/\/piperpweddingdj\.services\/p\/inv-mara/,
    )
    assert.doesNotMatch(letter.text, /Chapel/)
    assert.doesNotMatch(letter.text, /Mill Road/)
    assert.doesNotMatch(letter.text, /Butcher/)
    assert.doesNotMatch(letter.subject, /Butcher/)
  })

  it('writes an invoice letter from the invoice figures', () => {
    const letter = invoiceLetter(
      {
        ...sample,
        sample: false,
        invoice: {
          slug: 'inv-mara',
          status: 'void',
          totalCents: 165000,
          depositCents: 50000,
          receivedCents: 10000,
          balanceCents: 0,
        },
      },
      url,
    )
    assert.equal(letter.subject, 'Your invoice from Piper DJing')
    assert.match(letter.text, /void/)
    assert.match(letter.text, /\$1,650\.00/)
    assert.match(letter.text, /\$100\.00/)
    assert.match(letter.text, /Balance: \$0\.00/)
    assert.doesNotMatch(letter.text, /\$2,350\.00/)
    assert.doesNotMatch(letter.text, /Chapel/)
    assert.doesNotMatch(letter.text, /Butcher/)
  })

  it('names a custom discount and leaves it off when there is none', () => {
    const letter = bookingLetter({ ...sample, discountCents: 10000 }, url)
    assert.match(letter.text, /Discount: \$100\.00/)
    assert.match(letter.text, /Total: \$2,350\.00/)
    assert.doesNotMatch(bookingLetter(sample, url).text, /Discount:/)
  })

  it('refuses an invoice letter when there is no invoice', () => {
    assert.throws(
      () => invoiceLetter({ ...sample, invoice: null }, url),
      /no invoice/,
    )
  })
})

describe('payment receipt', () => {
  const booking: LetterBooking = {
    ...sample,
    status: 'booked',
    totalCents: 165000,
    invoice: {
      slug: 'inv-mara',
      status: 'sent',
      totalCents: 165000,
      depositCents: 50000,
      receivedCents: 100000,
      balanceCents: 65000,
    },
  }
  const payments = [
    { id: 1, cents: 50000, hstCents: 0, paidOn: '2026-10-01', method: 'card' },
    { id: 2, cents: 50000, hstCents: 6500, paidOn: '2026-10-13', method: 'card' },
  ]

  it('shows the HST on the card payment, on top of the balance', () => {
    const letter = paymentLetter(booking, payments, 2, url)
    assert.match(letter.subject, /Payment received/)
    assert.match(
      letter.text,
      /This payment: 13 October 2026: \$500\.00 by card \+ \$65\.00 HST \(13% on this card payment\) = \$565\.00 charged/,
    )
    assert.match(letter.text, /does not count toward your balance/)
    assert.match(letter.text, /- 1 October 2026: \$500\.00 by card\n/)
    assert.match(letter.text, /Paid so far: \$1,000\.00/)
    assert.match(letter.text, /Card HST paid \(on top\): \$65\.00/)
    assert.match(letter.text, /Remaining: \$650\.00/)
  })

  it('an e-transfer has no HST line', () => {
    const letter = paymentLetter(
      { ...booking, invoice: { ...booking.invoice!, receivedCents: 165000, balanceCents: 0 } },
      [...payments, { id: 3, cents: 65000, hstCents: 0, paidOn: '2026-10-20', method: 'e-transfer' }],
      3,
      url,
    )
    assert.match(letter.text, /This payment: 20 October 2026: \$650\.00 by e-transfer\n/)
    assert.match(letter.text, /Remaining: \$0\.00/)
  })
})

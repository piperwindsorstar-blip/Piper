import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  bookingLetter,
  coupleAddress,
  hasCoupleAddress,
  invoiceLetter,
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

  it('refuses an invoice letter when there is no invoice', () => {
    assert.throws(
      () => invoiceLetter({ ...sample, invoice: null }, url),
      /no invoice/,
    )
  })
})

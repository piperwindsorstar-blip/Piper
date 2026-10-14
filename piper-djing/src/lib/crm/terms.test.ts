import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { reviseTerms, TERMS_BODY } from './terms.ts'

const HOLD =
  'A date moves from open, to a hold, to booked. It does not move backward. A hold starts when the invoice is sent and the booking has a venue name and a street. The hold date is that day in Toronto. The hold runs 30 days, counting the day it starts.'

const DEPOSIT_NO_CUSTOM =
  'A wedding or a reception on its own is deposited at 30% of the total, to the nearest $25. A remainder that lands exactly halfway rounds down. The Pre-Party, a stag and doe on its own, is a flat $350 deposit. Ceremony only, The Aisle, is $350 paid in full. A full wedding day booked with a stag and doe is one booking, and the deposit for that booking is $500.'

const TRAVEL =
  'Wired uplights are $15 each. One-way driving distance from 39 Butcher Crescent, Brantford. Under 50 km is included. From 50 km to 100 km is $110. Over 100 km, up to 200 km, is $250. Over 200 km is $250 plus a hotel. The Aisle, ceremony only, includes travel.'

const VENUE =
  'If the ceremony is at a separate venue from the reception, a flat $75 second-venue fee applies. Two venues is the maximum; a third venue is not offered.'

const PAYMENT =
  'You can pay by e-transfer to PiperPWeddingDJ@gmail.com, by cash, or by card. Card payments toward the balance carry 13% HST on the amount paid by card. Deposits, e-transfer and cash carry no HST.'

const AGREEMENT =
  '4.5 Sending the deposit, or paying Ceremony only in full, is agreement to these terms. A signature is extra proof of that agreement. A signature by itself does not hold and does not book a date.'

const BOOKED =
  'Once a date is booked, later payments, refunds, and edits do not release it. Only a cancellation or a release changes that status.'

/** The very first document, before distance travel or the Custom event. */
const PREVIOUS = `Piper DJing

${HOLD}

The deposit is 30% of the total, to the nearest $25. A remainder that lands exactly halfway rounds down. Ceremony only is paid in full. A full wedding day booked with a stag and doe is one booking, and the deposit for that booking is $500.

Wired uplights are $15 each. Travel is calculated from the kilometres to each venue. Two venues is the maximum.

${BOOKED}`

/** Distances came in, and the old travel copy ended with "Two venues is the maximum." */
const AT_DISTANCE_TRAVEL = `Piper DJing

${HOLD}

${DEPOSIT_NO_CUSTOM}

${TRAVEL} Two venues is the maximum.

${BOOKED}`

/**
 * The live document, read off piperpweddingdj.services before this change. The
 * venue clause carries a stranded "Two venues is the maximum." and the deposit
 * still predates the Custom event.
 */
const LIVE = `Piper DJing

${HOLD}

${DEPOSIT_NO_CUSTOM}

${TRAVEL}

${VENUE} Two venues is the maximum.

${PAYMENT}

${AGREEMENT}

${BOOKED}`

describe('terms', () => {
  it('replaces the oldest deposit and travel sentences', () => {
    assert.equal(reviseTerms(PREVIOUS), TERMS_BODY)
    assert.match(TERMS_BODY, /flat \$350 deposit/)
    assert.match(TERMS_BODY, /39 Butcher Crescent, Brantford/)
    assert.match(TERMS_BODY, /\$250 plus a hotel/)
    assert.doesNotMatch(TERMS_BODY, /first 20/)
  })

  it('brings the live document forward', () => {
    assert.equal(reviseTerms(LIVE), TERMS_BODY)
  })

  it('brings a document from the distance-travel era forward', () => {
    assert.equal(reviseTerms(AT_DISTANCE_TRAVEL), TERMS_BODY)
  })

  it('states the packages and the venue fee once each', () => {
    assert.match(
      TERMS_BODY,
      /The Main Event, a full wedding day, is \$1,650\. The After Party, reception only, is \$1,550\. The Pre-Party, a stag and doe, is \$700\. The Aisle, ceremony only, is \$350 paid in full\. The Main Event and The Pre-Party booked together are \$250 off\. Every package covers the night up to 1:00 a\.m\. Overtime after 1:00 a\.m\. is \$250 an hour\./,
    )
    assert.equal(TERMS_BODY.match(/Two venues is the maximum/g)?.length, 1)
    assert.equal(TERMS_BODY.match(/a third venue is not offered/g)?.length, 1)
    assert.doesNotMatch(
      TERMS_BODY,
      /A separate ceremony venue is \$75\. A third venue is not offered\./,
    )
  })

  it('leaves a rewritten document alone', () => {
    const custom = `${TERMS_BODY}\n\nExtra note.`
    assert.equal(reviseTerms(custom), custom)
  })
})

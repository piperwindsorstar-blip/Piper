import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { reviseTerms, TERMS_BODY } from './terms.ts'

const PREVIOUS = `Piper DJing

A date moves from open, to a hold, to booked. It does not move backward. A hold starts when the invoice is sent and the booking has a venue name and a street. The hold date is that day in Toronto. The hold runs 30 days, counting the day it starts.

The deposit is 30% of the total, to the nearest $25. A remainder that lands exactly halfway rounds down. Ceremony only is paid in full. A full wedding day booked with a stag and doe is one booking, and the deposit for that booking is $500.

Wired uplights are $15 each. Travel is calculated from the kilometres to each venue. Two venues is the maximum.

Once a date is booked, later payments, refunds, and edits do not release it. Only a cancellation or a release changes that status.`

describe('terms', () => {
  it('replaces the old deposit and travel sentences', () => {
    assert.equal(reviseTerms(PREVIOUS), TERMS_BODY)
    assert.match(TERMS_BODY, /flat \$350 deposit/)
    assert.match(TERMS_BODY, /39 Butcher Crescent, Brantford/)
    assert.match(TERMS_BODY, /\$250 plus a hotel/)
    assert.doesNotMatch(TERMS_BODY, /first 20/)
  })

  it('leaves a rewritten document alone', () => {
    const custom = `${TERMS_BODY}\n\nExtra note.`
    assert.equal(reviseTerms(custom), custom)
  })
})

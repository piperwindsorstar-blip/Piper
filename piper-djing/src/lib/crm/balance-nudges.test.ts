import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { balanceBlock, balanceDue, balanceLetter } from './balance-nudges.ts'
import type { BalanceCouple } from './balance-nudges.ts'

const couple = (over: Partial<BalanceCouple> = {}): BalanceCouple => ({
  status: 'booked',
  sample: false,
  email: 'pat@example.com',
  eventDate: '2026-10-29',
  invoice: { status: 'sent', balanceCents: 70_000 },
  ...over,
})

describe('balance reminders', () => {
  it('one a month out and one in the last week', () => {
    assert.equal(balanceDue(couple(), '2026-09-28'), null) // 31 days
    assert.deepEqual(balanceDue(couple(), '2026-09-29'), { step: 'one-month', days: 30, balanceCents: 70_000 })
    assert.equal(balanceDue(couple(), '2026-10-21')?.step, 'one-month') // 8 days
    assert.equal(balanceDue(couple(), '2026-10-22')?.step, 'one-week') // 7 days
    assert.equal(balanceDue(couple(), '2026-10-28')?.step, 'one-week') // 1 day
    assert.equal(balanceDue(couple(), '2026-10-29'), null) // the day itself
  })

  it('skips paid, unsent, test, unbooked and email-less couples', () => {
    const today = '2026-10-15'
    assert.equal(balanceBlock(couple(), today), '')
    assert.equal(balanceBlock(couple({ invoice: { status: 'sent', balanceCents: 0 } }), today), 'Paid in full')
    assert.equal(balanceBlock(couple({ invoice: { status: 'draft', balanceCents: 70_000 } }), today), 'Invoice not sent')
    assert.equal(balanceBlock(couple({ invoice: null }), today), 'Invoice not sent')
    assert.equal(balanceBlock(couple({ sample: true }), today), 'Test booking')
    assert.equal(balanceBlock(couple({ status: 'hold' }), today), 'Not booked yet')
    assert.equal(balanceBlock(couple({ email: '' }), today), 'No email on file')
    assert.equal(balanceBlock(couple({ eventDate: '2027-03-12' }), today), 'More than a month to go')
  })

  it('the letter gives the amount, the ways to pay and the invoice link', () => {
    const letter = balanceLetter({
      partnerOne: 'Roxana',
      partnerTwo: 'Ibu',
      eventDate: '2026-10-29',
      due: { step: 'one-week', days: 5, balanceCents: 70_000 },
      invoiceLink: 'https://piperpweddingdj.services/p/abc',
      card: true,
    })
    assert.match(letter.subject, /\$700\.00 due before your wedding/)
    assert.match(letter.text, /^Hello Roxana and Ibu,/)
    assert.match(letter.text, /remaining balance of \$700\.00 is due before/)
    assert.match(letter.text, /by card on your invoice page/)
    assert.match(letter.text, /Your invoice: https:\/\/piperpweddingdj\.services\/p\/abc/)
    const noCard = balanceLetter({
      partnerOne: 'A',
      partnerTwo: 'B',
      eventDate: '2026-10-29',
      due: { step: 'one-month', days: 20, balanceCents: 70_000 },
      invoiceLink: 'x',
      card: false,
    })
    assert.doesNotMatch(noCard.text, /card/)
    assert.match(noCard.text, /about a month away/)
  })
})

describe('friendly automated line', () => {
  it('opens the balance reminder right after the greeting', () => {
    const letter = balanceLetter({
      partnerOne: 'Jordan Biggs',
      partnerTwo: '',
      eventDate: '2026-11-27',
      due: { step: 'one-week', balanceCents: 50000 } as Parameters<typeof balanceLetter>[0]['due'],
      invoiceLink: 'https://piperpweddingdj.services/p/2KUVJ7XPwBHI',
      card: true,
      nonWedding: true,
    })
    assert.equal(
      letter.text,
      [
        'Hello Jordan Biggs,',
        '',
        'This is a friendly automated email.',
        '',
        'Your remaining balance of $500.00 is due by 27 November 2026.',
        'You can pay by e-transfer to PiperPWeddingDJ@gmail.com or by cash, or by card on your invoice page (card adds a 3% card fee on the amount paid by card).',
        '',
        'Your invoice: https://piperpweddingdj.services/p/2KUVJ7XPwBHI',
        '',
        'If it is already on its way, thank you, and you can ignore this.',
        '',
        'Martin · DJ Piper P',
        'PiperPWeddingDJ@gmail.com',
      ].join('\n'),
    )
  })
})

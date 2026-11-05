import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { PUBLIC_EMAIL } from '../crm/defaults.ts'
import { questionLetter } from './questions.ts'

describe('couple questions', () => {
  it('puts the RSVP id, couple, text, and time in the owner email', () => {
    assert.equal(PUBLIC_EMAIL, 'PiperPWeddingDJ@gmail.com')
    const letter = questionLetter({
      rsvpId: 'sarah-and-michael',
      couple: 'Sarah & Michael',
      text: 'Can the first dance be September?',
      askedAt: '2026-10-11T21:00:00.000Z',
    })
    assert.equal(letter.subject, 'Question from Sarah & Michael')
    assert.match(letter.text, /sarah-and-michael/)
    assert.match(letter.text, /Sarah & Michael/)
    assert.match(letter.text, /Can the first dance be September\?/)
    assert.match(letter.text, /2026-10-11T21:00:00.000Z/)
  })
})

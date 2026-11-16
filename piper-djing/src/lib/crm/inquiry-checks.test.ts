import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { phoneProblem, publicDateProblem, stagAllowed } from './inquiry-checks.ts'

describe('public inquiry checks', () => {
  it('turns away a date that has already passed', () => {
    assert.match(String(publicDateProblem('2025-06-14', '2026-10-17')), /already passed/)
    assert.equal(publicDateProblem('2026-10-17', '2026-10-17'), null)
    assert.equal(publicDateProblem('2027-03-09', '2026-10-17'), null)
    assert.equal(publicDateProblem('', '2026-10-17'), 'Choose a date.')
  })

  it('names the stag date when that is the one in the past', () => {
    assert.match(
      String(publicDateProblem('2026-01-01', '2026-10-17', 'The stag and doe date')),
      /^The stag and doe date has already passed/,
    )
  })

  it('wants a real phone number', () => {
    assert.equal(phoneProblem('abc', true), 'Enter a phone number using digits.')
    assert.equal(phoneProblem('555', true), 'Enter a full phone number.')
    assert.equal(phoneProblem('', true), 'Enter a phone number.')
    assert.equal(phoneProblem('', false), null)
    assert.equal(phoneProblem('(519) 555-0100', true), null)
    assert.equal(phoneProblem('+1 519.555.0100', true), null)
  })

  it('offers the stag and doe only with the full wedding day', () => {
    assert.equal(stagAllowed('full'), true)
    for (const id of ['reception', 'stag', 'ceremony', 'custom']) {
      assert.equal(stagAllowed(id), false)
    }
  })
})

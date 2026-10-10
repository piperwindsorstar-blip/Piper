import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { heldDateNotice, parseDateRequest } from './date-request.ts'

const today = '2026-10-09'

describe('date request', () => {
  it('accepts a wedding on or after today', () => {
    assert.deepEqual(
      parseDateRequest(
        { date: '2026-10-09', eventType: 'Wedding', company: '' },
        today,
      ),
      { ok: true, silent: false, date: '2026-10-09', eventType: 'Wedding' },
    )
  })

  it('accepts a stag and doe and a ceremony-only date', () => {
    assert.equal(
      parseDateRequest(
        { date: '2026-11-14', eventType: 'Stag and doe', company: '' },
        today,
      ).ok,
      true,
    )
    assert.equal(
      parseDateRequest(
        { date: '2026-11-14', eventType: 'Ceremony only', company: '' },
        today,
      ).ok,
      true,
    )
  })

  it('rejects a past date and an unknown event', () => {
    assert.equal(
      parseDateRequest(
        { date: '2020-01-01', eventType: 'Wedding', company: '' },
        today,
      ).ok,
      false,
    )
    assert.equal(
      parseDateRequest(
        { date: '2026-12-01', eventType: 'Festival', company: '' },
        today,
      ).ok,
      false,
    )
  })

  it('keeps a held date on the checker and lets an open date continue', () => {
    assert.equal(heldDateNotice(false), 'That date is already held.')
    assert.equal(heldDateNotice(true), null)
  })

  it('stays quiet when the honeypot is filled', () => {
    assert.deepEqual(
      parseDateRequest({ date: '', eventType: '', company: 'spam co' }, today),
      { ok: true, silent: true },
    )
  })
})

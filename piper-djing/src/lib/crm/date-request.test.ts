import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { parseDateRequest } from './date-request.ts'

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

  it('stays quiet when the honeypot is filled', () => {
    assert.deepEqual(
      parseDateRequest({ date: '', eventType: '', company: 'spam co' }, today),
      { ok: true, silent: true },
    )
  })
})

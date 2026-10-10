import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  calendarWeeks,
  dateCheckAnswer,
  parseDateRequest,
} from './date-request.ts'

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

  it('answers yes when the date is available and no when it is not', () => {
    assert.equal(dateCheckAnswer(true), 'Yes, your date is available.')
    assert.equal(dateCheckAnswer(false), 'No, your date is not available.')
  })

  it('builds a Sunday-first month', () => {
    const weeks = calendarWeeks(2026, 9)
    assert.equal(weeks[0]?.[0]?.date, '2026-09-27')
    assert.equal(weeks[0]?.[0]?.inMonth, false)
    assert.equal(weeks[0]?.[4]?.date, '2026-10-01')
    assert.equal(weeks[0]?.[4]?.inMonth, true)
    assert.equal(weeks.at(-1)?.at(-1)?.date, '2026-10-31')
    assert.equal(
      weeks.every((week) => week.length === 7),
      true,
    )
  })

  it('stays quiet when the honeypot is filled', () => {
    assert.deepEqual(
      parseDateRequest({ date: '', eventType: '', company: 'spam co' }, today),
      { ok: true, silent: true },
    )
  })
})

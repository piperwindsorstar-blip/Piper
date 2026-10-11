import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { setLegacyDateReader } from '../legacy-book.server.ts'
import { CUSTOM_WEDDINGS } from './booking-rules.ts'
import { dateOpen } from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('date check', { skip: liveBook }, () => {
  it('treats the four saved weddings as taken', async () => {
    setLegacyDateReader(async () => 'open')
    for (const wedding of CUSTOM_WEDDINGS) {
      assert.equal(await dateOpen(wedding.date), false)
    }
  })

  it('leaves an ordinary date open when the old desk says open', async () => {
    setLegacyDateReader(async () => 'open')
    assert.equal(await dateOpen('2028-09-01'), true)
  })

  it('treats a date as taken when the old desk says taken', async () => {
    setLegacyDateReader(async () => 'taken')
    assert.equal(await dateOpen('2028-09-02'), false)
  })

  it('stays open for an ordinary date when the old desk does not answer', async () => {
    setLegacyDateReader(async () => 'unknown')
    assert.equal(await dateOpen('2028-09-03'), true)
  })
})

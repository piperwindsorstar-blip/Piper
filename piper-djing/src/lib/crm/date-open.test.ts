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

  it('leaves an ordinary date open', async () => {
    assert.equal(await dateOpen('2028-09-01'), true)
  })

  it('does not ask another site whether an ordinary date is taken', async () => {
    setLegacyDateReader(async () => 'taken')
    assert.equal(await dateOpen('2028-09-02'), true)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { bookEventLabel, bookEventType } from './book-events.ts'

describe('/book event types', () => {
  it('keeps every wedding event on the wedding form', () => {
    for (const event of ['', 'Wedding', 'Stag and doe', 'Ceremony only', 'Anniversary']) {
      assert.equal(bookEventType(event), 'Wedding')
    }
  })

  it('sends date checker events to the matching custom-quote form', () => {
    assert.equal(bookEventType('Birthday party'), 'Private')
    assert.equal(bookEventType('Christmas party'), 'Corporate')
    assert.equal(bookEventType('Corporate'), 'Corporate')
    assert.equal(bookEventLabel('Corporate', 'Corporate'), 'Corporate')
    assert.equal(bookEventType('Club night'), 'Club night')
    assert.equal(bookEventType('Community & Charity'), 'Community & Charity')
    assert.equal(bookEventType('Retirement party'), 'Private')
  })

  it('records the type with the checker words when they add something', () => {
    assert.equal(bookEventLabel('Corporate', 'Christmas party'), 'Corporate · Christmas party')
    assert.equal(bookEventLabel('Corporate', 'Corporate'), 'Corporate')
    assert.equal(bookEventLabel('Private', ''), 'Private')
    assert.equal(bookEventLabel('Private', 'Wedding'), 'Private')
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { isDeskUsageRoot } from './desk-rest.ts'
import { usageDocument } from './usage.ts'
import { ownerAddress } from '../crm/mail.server.ts'

describe('desk usage', () => {
  it('describes this book and the saved package prices', () => {
    assert.equal(isDeskUsageRoot('/api/bots/v1'), true)
    assert.equal(isDeskUsageRoot('/api/bots/v1/'), true)
    assert.equal(isDeskUsageRoot('/api/bots/v1/packages'), false)

    const usage = usageDocument([
      { id: 'full', name: 'Full wedding day', cents: 165000 },
      { id: 'reception', name: 'Reception only', cents: 155000 },
      { id: 'stag', name: 'A stag and doe', cents: 75000 },
      { id: 'ceremony', name: 'Ceremony only', cents: 35000 },
    ])
    const text = JSON.stringify(usage)
    assert.equal(usage.book, 'piperpweddingdj.services')
    assert.equal(usage.packages[2]?.priceCents, 75000)
    assert.match(text, /Names and prices can be changed/)
    assert.doesNotMatch(text, /prices stay locked/)
    assert.match(text, /CJ and Laura 2027-03-12 total 100000 deposit 30000/)
    assert.match(text, /These four packages stay/)
    assert.match(text, /Cancel a booking instead of deleting it/)
  })

  it('sends owner mail to the saved desk address', () => {
    assert.equal(ownerAddress('piper@example.com'), 'piper@example.com')
    assert.equal(ownerAddress('  '), 'PiperPWeddingDJ@gmail.com')
  })
})

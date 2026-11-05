import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { kindWordsOn, setKindWords } from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('kind words', { skip: liveBook }, () => {
  it('stays off until the desk turns it on', async () => {
    assert.equal(await kindWordsOn(), false)
    assert.equal(await setKindWords(true), true)
    assert.equal(await kindWordsOn(), true)
    assert.equal(await setKindWords(false), false)
    assert.equal(await kindWordsOn(), false)
  })
})

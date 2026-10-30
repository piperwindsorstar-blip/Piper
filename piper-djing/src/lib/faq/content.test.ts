import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FAQ_CLOSING, FAQ_INTRO, FAQ_SECTIONS, faqJsonLd } from './content.ts'

describe('faq page', () => {
  it('has all twenty questions from the draft in five sections', () => {
    assert.equal(FAQ_SECTIONS.length, 5)
    assert.equal(FAQ_SECTIONS.flatMap((s) => s.items).length, 20)
    assert.equal(JSON.parse(faqJsonLd()).mainEntity.length, 20)
  })

  it('never claims insurance', () => {
    const all = JSON.stringify([FAQ_INTRO, FAQ_SECTIONS, FAQ_CLOSING])
    assert.doesNotMatch(all, /insur|liability|certificate/i)
  })
})

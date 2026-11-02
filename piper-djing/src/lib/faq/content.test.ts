import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { FAQ_CLOSING, FAQ_INTRO, FAQ_SECTIONS, faqJsonLd } from './content.ts'

describe('faq page', () => {
  it('has all twenty questions from the draft in five sections', () => {
    assert.equal(FAQ_SECTIONS.length, 5)
    assert.equal(FAQ_SECTIONS.flatMap((s) => s.items).length, 20)
    assert.equal(JSON.parse(faqJsonLd()).mainEntity.length, 20)
  })

  it('gives the deposit by package, in the visible answer and the structured data', () => {
    const answer = FAQ_SECTIONS.flatMap((s) => s.items).find((item) => item.q === 'What is the deposit?')?.a
    assert.match(String(answer), /^For The Main Event, a full wedding day, or The After Party, reception only, the deposit is 30% of the total\./)
    const ld = JSON.parse(faqJsonLd()).mainEntity.find((q: { name: string }) => q.name === 'What is the deposit?')
    assert.equal(ld.acceptedAnswer.text, answer)
  })

  it('never claims insurance', () => {
    const all = JSON.stringify([FAQ_INTRO, FAQ_SECTIONS, FAQ_CLOSING])
    assert.doesNotMatch(all, /insur|liability|certificate/i)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { termsBlockLines, termsBlocks } from './terms-blocks.ts'

const BODY = [
  'DJ Piper P',
  '',
  'A date moves from open, to a hold, to booked.',
  '',
  '## Payment Terms',
  '',
  '- The deposit is due on booking.',
  '- The balance is due 14 days before.',
  '',
  'A line with a - dash and a ## in the middle stays as written.',
  '## Cancellation & Refunds',
  '- One item.',
].join('\n')

describe('terms blocks', () => {
  it('reads headings, lists and paragraphs', () => {
    assert.deepEqual(
      termsBlocks(BODY).map((block) => block.kind),
      ['paragraph', 'paragraph', 'heading', 'list', 'paragraph', 'heading', 'list'],
    )
  })

  it('keeps every word, only dropping the two markers', () => {
    const expected = BODY.split('\n')
      .filter((line) => line.trim() !== '')
      .map((line) => line.replace(/^## /, '').replace(/^- /, ''))
    assert.deepEqual(termsBlockLines(termsBlocks(BODY)), expected)
  })

  it('reads Windows line endings the same way', () => {
    assert.deepEqual(
      termsBlockLines(termsBlocks(BODY.replaceAll('\n', '\r\n'))),
      termsBlockLines(termsBlocks(BODY)),
    )
  })
})

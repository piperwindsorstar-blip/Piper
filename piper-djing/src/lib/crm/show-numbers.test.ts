import assert from 'node:assert/strict'
import { test } from 'node:test'
import { missingNumbers, nextShowNumber } from './show-numbers.ts'

test('numbers run per event year: 26-01, 26-02, then 27-01', () => {
  assert.deepEqual(
    missingNumbers([
      { id: 16, eventDate: '2026-11-28', sample: false, showNumber: '' },
      { id: 1, eventDate: '2027-06-12', sample: false, showNumber: '' },
      { id: 9, eventDate: '2026-08-01', sample: false, showNumber: '' },
      { id: 14, eventDate: '2026-12-05', sample: true, showNumber: '' },
    ]),
    [
      { id: 9, showNumber: '26-01' },
      { id: 16, showNumber: '26-02' },
      { id: 1, showNumber: '27-01' },
    ],
  )
})

test('a given number stays; new ones come after the highest', () => {
  assert.equal(nextShowNumber(['26-01', '26-07', '27-02'], '2026-12-01'), '26-08')
  assert.deepEqual(
    missingNumbers([
      { id: 1, eventDate: '2026-05-01', sample: false, showNumber: '26-03' },
      { id: 2, eventDate: '2026-04-01', sample: false, showNumber: '' },
    ]),
    [{ id: 2, showNumber: '26-04' }],
  )
})

test('a booking moved to another year gets that year\'s next number', () => {
  assert.deepEqual(
    missingNumbers([
      { id: 1, eventDate: '2027-05-01', sample: false, showNumber: '26-01' },
      { id: 2, eventDate: '2027-04-01', sample: false, showNumber: '27-01' },
    ]),
    [{ id: 1, showNumber: '27-02' }],
  )
})

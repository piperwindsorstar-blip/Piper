import assert from 'node:assert/strict'
import { test } from 'node:test'
import { invoiceLines } from './invoice-lines.ts'

const wedding = {
  packageId: 'full', packageName: 'Full wedding day', nonWedding: false, eventType: '',
  lockedTotal: false, withStag: false, totalCents: 165000 + 3000 + 7500 + 11000, discountCents: 0,
  uplights: 2, venueTwoName: 'St. Mark', travelFeeCents: 11000, distanceFeeCents: 0,
}

test('a wedding lists the package, uplights, the $75 second venue and travel', () => {
  assert.deepEqual(invoiceLines(wedding), [
    ['Full wedding day', 165000],
    ['Wired uplights × 2', 3000],
    ['Second venue setup', 7500],
    ['Travel', 11000],
  ])
})

test('the lines add up to the total plus the discount', () => {
  const lines = invoiceLines({ ...wedding, totalCents: wedding.totalCents - 10000, discountCents: 10000 })
  assert.equal(lines.reduce((sum, [, cents]) => sum + cents, 0), wedding.totalCents)
})

test('an event lists its type and the distance fee', () => {
  assert.deepEqual(
    invoiceLines({ ...wedding, packageId: 'custom', nonWedding: true, eventType: 'Corporate', totalCents: 95000, uplights: 0, venueTwoName: '', travelFeeCents: 0, distanceFeeCents: 5000 }),
    [['Corporate', 90000], ['Distance fee', 5000]],
  )
})

test('an agreed or locked price is one line', () => {
  assert.deepEqual(invoiceLines({ ...wedding, packageId: 'custom', totalCents: 250000 }), [['Agreed price', 250000]])
  assert.deepEqual(invoiceLines({ ...wedding, lockedTotal: true, totalCents: 200000 }), [['Full wedding day', 200000]])
})

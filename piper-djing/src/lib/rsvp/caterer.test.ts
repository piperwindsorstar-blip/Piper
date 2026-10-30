import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { catererSheet, mealLetters } from './caterer.ts'
import { sampleWedding } from './demo.ts'
import { emptySeating, seatParty } from './seating.ts'
import type { SeatingPlan } from './seating.ts'

function planWithTable(): SeatingPlan {
  const base = emptySeating()
  return {
    ...base,
    tables: [
      { id: 't1', name: '1', shape: 'round', seats: 8, x: 200, y: 200, w: 60, h: 60, rotation: 0 },
      { id: 't2', name: '2', shape: 'round', seats: 8, x: 400, y: 200, w: 60, h: 60, rotation: 0 },
    ],
  }
}

describe('the caterer report', () => {
  it('gives each offered meal a letter in order, K kept for kids', () => {
    const letters = mealLetters(['Prime rib', 'Wild salmon'], ['Wild salmon', 'Tofu'])
    assert.deepEqual([...letters.entries()], [
      ['Prime rib', 'A'],
      ['Wild salmon', 'B'],
      ['Tofu', 'C'],
    ])
  })

  it('totals meals with kids on their own, lists dietary notes and tables', () => {
    const wedding = sampleWedding()
    const kid = wedding.parties.flatMap((party) => party.guests).find((guest) => guest.isChild)
    const seated = seatParty(planWithTable(), ['liz', 'david'], 't1')
    assert.ok(seated.ok)
    const sheet = catererSheet(wedding, seated.ok ? seated.plan : planWithTable())
    assert.equal(sheet.attending, sheet.adults + sheet.kids)
    assert.equal(
      sheet.meals.reduce((sum, meal) => sum + meal.total, 0),
      sheet.attending,
      'every attending guest is counted in exactly one meal row',
    )
    const liz = sheet.dietary.find((guest) => guest.id === 'liz')
    assert.equal(liz?.dietary, 'Gluten-free')
    assert.equal(liz?.table, 'Table 1')
    assert.equal(sheet.tables[0]?.table, 'Table 1')
    assert.deepEqual(
      sheet.tables[0]?.guests.map((guest) => guest.name),
      ['Elizabeth Miller', 'David Miller'],
    )
    assert.ok(sheet.unseated.length > 0)
    if (kid && kid.replies.ceremony === 'attending' && !kid.meal) {
      assert.ok(sheet.meals.some((meal) => meal.code === 'K'))
    }
  })
})

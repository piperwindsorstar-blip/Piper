import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  incomeTotals,
  mondayOf,
  payPeriods,
  periodStart,
  rateOn,
  shiftMinutes,
  weeklyHours,
} from './fin.ts'
import type { Shift } from './fin.ts'
import { SEED_INCOME, SEED_RATES, SEED_SHIFTS } from './seed.ts'
import { addIncome, addShift, readFinancials, removeRow, updateIncome } from './fin.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const shift = (date: string, start: string, end: string, id = 1): Shift => ({
  id, date, start, end, kind: 'hourly', code: '', notes: '',
})

describe('financial rules', () => {
  it('matches the sheet: 39 entries, $48,631', () => {
    assert.equal(SEED_INCOME.length, 39)
    assert.equal(incomeTotals(SEED_INCOME.map((row, id) => ({ ...row, id }))).total, 4_863_100)
    assert.equal(SEED_SHIFTS.filter((s) => s.kind === 'gig').length, 26)
  })

  it('counts overnight shifts and finds the rate in force', () => {
    assert.equal(shiftMinutes('20:00', '01:30'), 330)
    assert.equal(shiftMinutes('09:00', '13:00'), 240)
    assert.equal(rateOn('2026-01-31', SEED_RATES), 2100)
    assert.equal(rateOn('2026-02-01', SEED_RATES), 2300)
  })

  it('uses two-week periods from Sunday, January 4, 2026', () => {
    assert.equal(periodStart('2026-01-20'), '2026-01-18')
    assert.equal(periodStart('2026-02-14'), '2026-02-01')
    assert.equal(periodStart('2026-02-15'), '2026-02-15')
    assert.equal(mondayOf('2026-10-28'), '2026-10-26')
  })

  it('agrees with the sheet on the first pay periods', () => {
    const shifts = SEED_SHIFTS.map((row, id) => ({ ...row, id, notes: '' }))
    const periods = payPeriods(shifts, SEED_RATES)
    const jan = periods.find((p) => p.start === '2026-01-18')
    const feb = periods.find((p) => p.start === '2026-02-01')
    assert.equal(jan?.hours, 42.5)
    assert.equal(jan?.cents, 89_250)
    assert.equal(feb?.hours, 17)
    assert.equal(feb?.cents, 39_100)
    assert.deepEqual(feb?.gigs, ['26-0049'])
  })

  it('pays 1.5x after 44 hours in a payroll week', () => {
    const week = ['2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05'].map((d, i) => shift(d, '08:00', '18:00', i))
    const [period] = payPeriods(week, SEED_RATES)
    assert.equal(period?.hours, 50)
    assert.equal(period?.overtimeHours, 6)
    assert.equal(period?.cents, 44 * 2300 + 6 * 3450)
    assert.equal(weeklyHours(week)[0]?.total, 40)
  })
})

describe('financials in the book', { skip: liveBook }, () => {
  it('seeds once, then adds, edits and deletes', async () => {
    let data = await readFinancials()
    assert.equal(data.income.length, 39)
    assert.equal(data.shifts.length, SEED_SHIFTS.length)
    assert.equal(data.rates.length, 2)
    await addIncome({ date: '2026-10-28', name: 'Tip - Test', amount: '50', category: 'tip' })
    data = await readFinancials()
    const added = data.income.find((row) => row.name === 'Tip - Test')
    assert.ok(added)
    await updateIncome(added.id, { date: '2026-10-28', name: 'Tip - Test', amount: '75', category: 'tip' })
    assert.equal((await readFinancials()).income.find((row) => row.id === added.id)?.cents, 7500)
    await removeRow('income', added.id)
    assert.equal((await readFinancials()).income.length, 39)
    await addShift({ date: '2026-10-28', kind: 'hourly', start: '9:00', end: '13:00', code: '', notes: '' })
    const newest = (await readFinancials()).shifts[0]
    assert.equal(newest?.start, '09:00')
    await assert.rejects(() => addIncome({ date: '2026-10-28', name: 'x', amount: '-1', category: 'tip' }), /dollars/)
  })
})

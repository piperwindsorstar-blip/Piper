import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { daysBetween, finishDate, nudgeBlock, nudgeDue, nudgeLetter, stepFor } from './nudges.ts'
import type { NudgeCouple } from './nudges.ts'

const couple = (over: Partial<NudgeCouple> = {}): NudgeCouple => ({
  status: 'booked',
  sample: false,
  email: 'pat@example.com',
  eventDate: '2026-12-12',
  planning: { dueDate: '', planLocked: false },
  percent: 20,
  ...over,
})

describe('plan reminders', () => {
  it('finish date is the set due date, or 5 days before', () => {
    assert.equal(finishDate({ dueDate: '' }, '2026-12-12'), '2026-12-07')
    assert.equal(finishDate({ dueDate: '2026-11-30' }, '2026-12-12'), '2026-11-30')
    assert.equal(daysBetween('2026-10-15', '2026-10-14'), -1)
  })

  it('each window maps to one step', () => {
    assert.equal(stepFor(61), null)
    assert.equal(stepFor(60), 'eight-weeks')
    assert.equal(stepFor(31), 'eight-weeks')
    assert.equal(stepFor(30), 'four-weeks')
    assert.equal(stepFor(14), 'two-weeks')
    assert.equal(stepFor(7), 'one-week')
    assert.equal(stepFor(2), 'two-days')
    assert.equal(stepFor(0), 'two-days')
    assert.equal(stepFor(-3), 'past-due')
  })

  it('only booked, real, unfinished, unlocked couples with an email', () => {
    const today = '2026-11-01' // finish 2026-12-07 is 36 days out
    assert.deepEqual(nudgeDue(couple(), today), { step: 'eight-weeks', finish: '2026-12-07', days: 36 })
    assert.equal(nudgeBlock(couple({ sample: true }), today), 'Test booking')
    assert.equal(nudgeBlock(couple({ status: 'hold' }), today), 'Not booked yet')
    assert.equal(nudgeBlock(couple({ percent: 100 }), today), 'Plan finished')
    assert.equal(nudgeBlock(couple({ email: '' }), today), 'No email on file')
    assert.equal(nudgeBlock(couple({ planning: { dueDate: '', planLocked: true } }), today), 'Plan locked')
    assert.equal(nudgeBlock(couple({ planning: { dueDate: '2026-10-30', planLocked: false } }), today), 'Plan locked')
    assert.equal(nudgeBlock(couple(), '2026-09-01'), 'More than 8 weeks to go')
    assert.equal(nudgeBlock(couple(), '2026-12-12'), 'Wedding has passed')
    // Past the default finish date but before the wedding: one last nudge.
    assert.equal(nudgeDue(couple(), '2026-12-09')?.step, 'past-due')
  })

  it('the letter says where they are and links the plan', () => {
    const letter = nudgeLetter({
      partnerOne: 'Pat',
      partnerTwo: 'Sam',
      eventDate: '2026-12-12',
      link: 'https://piperpweddingdj.services/c/abc',
      due: { step: 'two-days', finish: '2026-12-07', days: 1 },
      answered: 10,
      total: 38,
      percent: 26,
      next: 'First dance',
    })
    assert.equal(letter.subject, 'Your music plan is due soon')
    assert.match(letter.text, /^Hello Pat and Sam,/)
    assert.match(letter.text, /10 of 38 answered, 28 to go/)
    assert.match(letter.text, /That's tomorrow\./)
    assert.match(letter.text, /Next up: First dance\./)
    assert.match(letter.text, /Open your plan: https:\/\/piperpweddingdj\.services\/c\/abc/)
    const fresh = nudgeLetter({
      partnerOne: 'Pat',
      partnerTwo: 'Sam',
      eventDate: '2026-12-12',
      link: 'x',
      due: { step: 'four-weeks', finish: '2026-12-07', days: 20 },
      answered: 0,
      total: 38,
      percent: 0,
      next: '',
    })
    assert.equal(fresh.subject, 'Time to start your music plan')
    assert.match(fresh.text, /haven't started/)
    assert.doesNotMatch(fresh.text, /Next up/)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blankPlanning } from '../crm/planning.ts'
import { masterDrafts, masterFromDrafts, parseMaster } from './master.ts'
import { overallProgress } from './progress.ts'
import { sectionQuestions } from './questions.ts'

const seed = {
  coupleNames: '',
  email: '',
  phone: '',
  weddingDate: '',
  venueName: '',
}

describe('portal master wording', () => {
  it('stores only the wording that differs from the code', () => {
    const drafts = masterDrafts({})
    const lastName = drafts.find((draft) => draft.id === 'lastName')
    assert.ok(lastName)
    const changed = masterFromDrafts(
      drafts.map((draft) =>
        draft.id === 'lastName'
          ? { ...draft, label: 'Which last name should I announce?' }
          : draft,
      ),
    )
    assert.deepEqual(changed.lastName, {
      label: 'Which last name should I announce?',
    })
    assert.equal(changed.phone, undefined)
    const again = masterFromDrafts(
      masterDrafts(changed).map((draft) =>
        draft.id === 'lastName'
          ? { ...draft, label: draft.defaults.label }
          : draft,
      ),
    )
    assert.equal(again.lastName, undefined)
  })

  it('hides a question on every plan and keeps a couple rename', () => {
    const master = parseMaster({
      guestCount: { hidden: true, label: 'Headcount' },
      'timeline-8': { label: 'Your song' },
    })
    const planning = blankPlanning(seed)
    planning.timeline[8] = { ...planning.timeline[8], label: 'Our dance' }
    const questions = sectionQuestions(planning, 'timeline', master)
    const firstDance = questions.find(
      (question) => question.id === 'timeline-8',
    )
    assert.ok(firstDance)
    assert.equal(firstDance.rail, 'Our dance')
    assert.equal(firstDance.label, 'Our dance')
    const progress = overallProgress(planning, master)
    const plain = overallProgress(planning)
    assert.equal(progress.total, plain.total - 1)
    const details = sectionQuestions(planning, 'details', master)
    const guestCount = details.find((question) => question.id === 'guestCount')
    assert.ok(guestCount)
    assert.equal(guestCount.hiddenByMaster, true)
    assert.equal(guestCount.label, 'Headcount')
  })
})

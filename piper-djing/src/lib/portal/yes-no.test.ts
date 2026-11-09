import assert from 'node:assert/strict'
import { test } from 'node:test'
import { blankPlanning } from '../crm/planning.ts'
import { allQuestions, isYesNo, yesNoAnswer } from './questions.ts'

test('closed questions are plain Yes/No', () => {
  const byId = new Map(allQuestions(
      blankPlanning({ coupleNames: 'A and B', email: '', phone: '', weddingDate: '2027-06-05', venueName: '' }),
    ).map((question) => [question.id, question]))
  for (const id of ['mcToldFindDj', 'tableForDj', 'spaceForDj', 'outside', 'power']) {
    assert.equal(isYesNo(byId.get(id)?.options), true, id)
  }
  assert.equal(isYesNo(byId.get('guestRequests')?.options), false)
})

test('answers saved before keep their meaning', () => {
  assert.equal(yesNoAnswer('Yes'), 'Yes')
  assert.equal(yesNoAnswer('Yes, they know'), 'Yes')
  assert.equal(yesNoAnswer("Not yet, I'll tell them"), 'No')
  assert.equal(yesNoAnswer('Not yet'), 'No')
  assert.equal(yesNoAnswer('Not sure'), 'No')
  assert.equal(yesNoAnswer('No'), 'No')
  assert.equal(yesNoAnswer(''), '')
})

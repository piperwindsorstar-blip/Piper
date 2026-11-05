import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sampleWedding } from './demo.ts'
import { applyCoupleReply, guestOutcome, overviewStats } from './model.ts'

const NOW = '2026-10-13T23:30:00.000Z'

describe('couple marks a reply (phone or paper)', () => {
  it('marks a waiting guest attending with a dinner', () => {
    const wedding = sampleWedding()
    const before = overviewStats(wedding, Date.parse(NOW))
    const result = applyCoupleReply(
      wedding,
      'thompson',
      [{ id: 'william', replies: { ceremony: 'attending' }, meal: 'Prime rib' }],
      NOW,
    )
    assert.ok(result.ok)
    const party = result.party
    assert.equal(party.lastRepliedAt, NOW)
    assert.equal(party.phoneReply, true)
    assert.equal(party.guests[0]?.meal, 'Prime rib')
    assert.equal(guestOutcome(party.guests[0]!, party), 'attending')
    const after = overviewStats(result.wedding, Date.parse(NOW))
    assert.equal(after.attending, before.attending + 1)
    // The original is untouched.
    assert.equal(wedding.parties.find((p) => p.id === 'thompson')?.lastRepliedAt, '')
  })

  it('not attending clears the dinner', () => {
    const result = applyCoupleReply(
      sampleWedding(),
      'thompson',
      [{ id: 'william', replies: { ceremony: 'declined' }, meal: 'Prime rib' }],
      NOW,
    )
    assert.ok(result.ok)
    assert.equal(result.party.guests[0]?.meal, '')
    assert.equal(guestOutcome(result.party.guests[0]!, result.party), 'declined')
  })

  it('refuses a dinner that is not on the menu', () => {
    const result = applyCoupleReply(
      sampleWedding(),
      'thompson',
      [{ id: 'william', replies: { ceremony: 'attending' }, meal: 'Pizza' }],
      NOW,
    )
    assert.equal(result.ok, false)
  })

  it('children get no dinner; events not invited to are ignored', () => {
    const result = applyCoupleReply(
      sampleWedding(),
      'miller',
      [{ id: 'nora', replies: { ceremony: 'attending', rehearsal: 'attending' }, meal: 'Prime rib' }],
      NOW,
    )
    assert.ok(result.ok)
    const nora = result.party.guests.find((guest) => guest.id === 'nora')
    assert.equal(nora?.meal, '')
    assert.equal(nora?.replies.rehearsal, undefined)
  })

  it('setting everyone back to no reply puts the party back to waiting', () => {
    const result = applyCoupleReply(
      sampleWedding(),
      'rose',
      [{ id: 'grandma', replies: {}, meal: '' }],
      NOW,
    )
    assert.ok(result.ok)
    assert.equal(result.party.lastRepliedAt, '')
    assert.equal(result.party.phoneReply, false)
  })

  it('an unknown party is refused', () => {
    assert.equal(applyCoupleReply(sampleWedding(), 'nobody', [], NOW).ok, false)
  })
})

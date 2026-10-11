import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sampleWedding } from './demo.ts'
import {
  confirmGuestList,
  partyLabel,
  splitGuestPaste,
  tidyGuestNames,
  toBotGuests,
} from './guest-list.ts'
import { overviewStats } from './model.ts'

describe('guest list paste', () => {
  it('splits lines and commas and drops blanks and duplicates', () => {
    assert.deepEqual(splitGuestPaste('Ann\nBen\nAnn\n\n  Cara  '), [
      'Ann',
      'Ben',
      'Cara',
    ])
    assert.deepEqual(splitGuestPaste('Ann, Ben, Ann'), ['Ann', 'Ben'])
    assert.deepEqual(splitGuestPaste('Ann,\r\nBen,  '), ['Ann', 'Ben'])
    assert.deepEqual(splitGuestPaste('  , \n '), [])
    assert.deepEqual(splitGuestPaste('José García\nJose Garcia'), [
      'José García',
    ])
  })

  it('keeps a saved row whole, including a comma', () => {
    assert.deepEqual(tidyGuestNames([' Smith, John ', 'Smith John', '']), [
      'Smith, John',
    ])
  })

  it('keeps each party link and lets a guest stand alone', () => {
    let n = 0
    const fresh = () => {
      n += 1
      return `id-${n}`
    }
    const wedding = sampleWedding()
    const saved = confirmGuestList(
      wedding,
      [
        {
          id: 'liz',
          name: 'Elizabeth Miller',
          partyId: 'miller',
          plusOneAllowed: true,
        },
        {
          id: 'david',
          name: 'David Miller',
          partyId: 'miller',
          plusOneAllowed: false,
        },
        {
          id: 'nora',
          name: 'Nora Miller',
          partyId: 'solo-nora',
          plusOneAllowed: false,
        },
      ],
      ['Prime rib', 'Wild salmon'],
      fresh,
    )
    if (!saved.ok) throw new Error('save failed')
    const miller = saved.wedding.parties.find((party) => party.id === 'miller')
    const nora = saved.wedding.parties.find((party) =>
      party.guests.some((guest) => guest.id === 'nora'),
    )
    assert.ok(miller)
    assert.equal(miller.token, 'miller')
    assert.equal(
      miller.guests.some((guest) => guest.id === 'jordan'),
      true,
    )
    assert.ok(nora)
    assert.notEqual(nora.id, 'miller')
    assert.equal(nora.guests.length, 1)
    assert.equal(
      partyLabel(['Elizabeth Miller', 'David Miller']),
      'Elizabeth Miller & David Miller',
    )
    const stats = overviewStats(
      saved.wedding,
      Date.parse('2026-10-11T22:02:00.000Z'),
    )
    assert.equal(stats.attending, 3)
    const jordan = toBotGuests(saved.wedding).find(
      (guest) => guest.id === 'jordan',
    )
    if (!jordan) throw new Error('missing plus-one')
    assert.equal(jordan.plusOneOf, 'liz')
    assert.equal(jordan.isPlusOne, true)
    assert.equal(jordan.partyId, 'miller')
  })
})

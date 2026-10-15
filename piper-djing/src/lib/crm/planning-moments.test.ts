import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addCustomMoment,
  applyLiveInquiry,
  blankPlanning,
  planningFromUnknown,
  reorderMoments,
  addCustomEntry,
  momentFilled,
  pairCount,
  patchEntry,
  setEntranceMode,
  setPairCount,
  togglePartyEntry,
} from './planning.ts'
import type { TimelineRow } from './planning.ts'

const seed = {
  coupleNames: 'Ada and Ben',
  email: 'ada@example.com',
  phone: '555-0100',
  weddingDate: '12 June 2028',
  venueName: 'The Hall',
  ceremonyAddress: '12 Chapel Lane',
  receptionAddress: '12 Chapel Lane',
}

describe('ordered moments', () => {
  it('reorders a section and keeps the new order', () => {
    const planning = blankPlanning(seed)
    const next = reorderMoments(
      planning.timeline,
      'Ceremony',
      'recessional',
      'guest-arrival',
    )
    const ceremony = next
      .filter((row) => row.section === 'Ceremony')
      .map((row) => row.id)
    assert.equal(ceremony[0], 'recessional')
    assert.equal(ceremony[1], 'guest-arrival')
    const saved = planningFromUnknown({ timeline: next }, seed)
    assert.equal(
      saved.timeline.find((row) => row.section === 'Ceremony')?.id,
      'recessional',
    )
  })

  it('hides presets, restores them, and drops empty other rows', () => {
    const planning = planningFromUnknown(
      {
        timeline: [
          { activity: 'Other (put in notes)', section: 'Reception' },
          {
            activity: 'First dance',
            song: 'At Last',
            artist: 'Etta James',
          },
          {
            activity: 'Unity candle',
            section: 'Ceremony',
            song: 'Ave Maria',
            time: '4:15',
          },
          {
            presetKey: 'bouquet',
            activity: 'Bouquet toss',
            section: 'Reception',
            hidden: true,
          },
        ],
      },
      seed,
    )
    const first = planning.timeline.find(
      (row) => row.presetKey === 'first-dance',
    )
    assert.equal(first?.song, 'At Last')
    assert.equal(
      planning.timeline.some((row) => row.activity.startsWith('Other')),
      false,
    )
    const custom = planning.timeline.find(
      (row) => row.activity === 'Unity candle',
    )
    assert.ok(custom)
    assert.equal(custom.presetKey, '')
    assert.equal(custom.section, 'Ceremony')
    const bouquet = planning.timeline.find((row) => row.presetKey === 'bouquet')
    assert.equal(bouquet?.hidden, true)
    assert.equal(planning.fromInquiry.length, 0)
    const added = addCustomMoment(planning.timeline, 'Reception', 'Shoe game')
    assert.equal(
      added.filter((row) => row.section === 'Reception').at(-1)?.activity,
      'Shoe game',
    )
  })

  it('has no dinner music moment and drops it from saved plans', () => {
    assert.equal(
      blankPlanning(seed).timeline.some((row) => row.presetKey === 'dinner'),
      false,
    )
    const saved = planningFromUnknown(
      {
        timeline: [
          { presetKey: 'dinner', activity: 'Dinner music', song: 'Moon River' },
        ],
      },
      seed,
    )
    assert.equal(
      saved.timeline.some((row) => /dinner/i.test(row.activity)),
      false,
    )
  })

  it('has no cake cutting and drops it from saved plans', () => {
    assert.equal(
      blankPlanning(seed).timeline.some((row) => row.presetKey === 'cake'),
      false,
    )
    const saved = planningFromUnknown(
      {
        timeline: [
          { presetKey: 'cake', activity: 'Cake cutting', song: 'Sugar' },
          { presetKey: 'first-dance', song: 'At Last' },
        ],
      },
      seed,
    )
    assert.equal(
      saved.timeline.some((row) => row.presetKey === 'cake'),
      false,
    )
    assert.equal(
      saved.timeline.some((row) => row.activity === 'Cake cutting'),
      false,
    )
    assert.equal(
      saved.timeline.find((row) => row.presetKey === 'first-dance')?.song,
      'At Last',
    )
  })

  it('lets the bridal party pick groups and add their own, each with a song', () => {
    let entries = togglePartyEntry([], 'groom', true)
    entries = togglePartyEntry(entries, 'bridesmaids', true)
    entries = togglePartyEntry(entries, 'bridesmaids', true)
    assert.deepEqual(
      entries.map((entry) => entry.id),
      ['groom', 'bridesmaids'],
    )
    entries = addCustomEntry(entries, 'Flower girl')
    entries = patchEntry(entries, 'groom', {
      song: 'Hey Ya',
      artist: 'Outkast',
    })
    entries = togglePartyEntry(entries, 'groom', false)
    assert.deepEqual(
      entries.map((entry) => entry.name),
      ['Bridesmaids', 'Flower girl'],
    )
    const base = blankPlanning(seed)
    const planning = planningFromUnknown(
      {
        timeline: base.timeline.map((row) =>
          row.presetKey === 'bridal-party' ? { ...row, entries } : row,
        ),
      },
      seed,
    )
    const row = planning.timeline.find(
      (item) => item.presetKey === 'bridal-party',
    )
    assert.equal(row?.entries.length, 2)
    assert.equal(momentFilled(row as TimelineRow), false)
    const filled = patchEntry(entries, 'bridesmaids', { song: 'Valerie' })
    assert.equal(
      momentFilled({ ...(row as TimelineRow), entries: filled }),
      true,
    )
  })

  it('splits the wedding party entrance three ways and keeps custom entries', () => {
    let entries = setEntranceMode([], 'pairs', 3)
    assert.deepEqual(
      entries.map((entry) => entry.id),
      ['pair-1', 'pair-2', 'pair-3'],
    )
    entries = patchEntry(entries, 'pair-2', { song: 'Dancing Queen' })
    entries = addCustomEntry(entries, 'Ring bearer')
    entries = setPairCount(entries, 2)
    assert.equal(pairCount(entries), 2)
    assert.equal(
      entries.find((entry) => entry.id === 'pair-2')?.song,
      'Dancing Queen',
    )
    entries = setEntranceMode(entries, 'split')
    assert.deepEqual(entries.map((entry) => entry.id).slice(0, 2), [
      'bridesmaids',
      'groomsmen',
    ])
    assert.equal(
      entries.some((entry) => entry.name === 'Ring bearer'),
      true,
    )
    entries = setEntranceMode(entries, 'whole')
    assert.equal(entries[0]?.id, 'whole')
    assert.equal(
      entries.some((entry) => entry.name === 'Ring bearer'),
      true,
    )
  })

  it('keeps the couple entrance checkbox and the speakers list', () => {
    const base = blankPlanning(seed)
    const planning = planningFromUnknown(
      {
        timeline: base.timeline.map((row) => {
          if (row.presetKey === 'entrance-couple')
            return { ...row, direct: true }
          if (row.presetKey === 'speeches')
            return {
              ...row,
              entries: [{ id: 'custom-1', name: 'Best man', time: '7:15 pm' }],
            }
          return row
        }),
      },
      seed,
    )
    const couple = planning.timeline.find(
      (row) => row.presetKey === 'entrance-couple',
    )
    const speeches = planning.timeline.find(
      (row) => row.presetKey === 'speeches',
    )
    assert.equal(couple?.direct, true)
    assert.equal(speeches?.entries[0]?.time, '7:15 pm')
    assert.equal(momentFilled(speeches as TimelineRow), true)
  })

  it('carries a single saved song into the new party entries', () => {
    const planning = planningFromUnknown(
      {
        timeline: [
          {
            presetKey: 'bridal-party',
            song: 'Canon in D',
            artist: 'Pachelbel',
          },
          { presetKey: 'entrance-party', song: 'Signed', artist: 'Sealed' },
        ],
      },
      seed,
    )
    const bridal = planning.timeline.find(
      (row) => row.presetKey === 'bridal-party',
    )
    const entrance = planning.timeline.find(
      (row) => row.presetKey === 'entrance-party',
    )
    assert.equal(bridal?.entries[0]?.song, 'Canon in D')
    assert.equal(bridal?.song, '')
    assert.equal(entrance?.mode, 'whole')
    assert.equal(entrance?.entries[0]?.song, 'Signed')
  })

  it('fills inquiry fields until the couple edits them', () => {
    const saved = planningFromUnknown(
      {
        email: 'old@example.com',
        fromInquiry: ['email', 'venueName', 'ceremonyAddress'],
      },
      seed,
    )
    const live = applyLiveInquiry(saved, {
      ...seed,
      email: 'new@example.com',
      venueName: 'The Hall',
    })
    assert.equal(live.email, 'new@example.com')
    assert.equal(live.venueName, 'The Hall')
    assert.equal(live.ceremonyAddress, '12 Chapel Lane')
    const edited = applyLiveInquiry(
      planningFromUnknown({ email: 'kept@example.com', fromInquiry: [] }, seed),
      { ...seed, email: 'new@example.com' },
    )
    assert.equal(edited.email, 'kept@example.com')
  })
})

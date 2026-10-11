import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addCustomMoment,
  applyLiveInquiry,
  blankPlanning,
  planningFromUnknown,
  reorderMoments,
  syncAppearanceSongs,
} from './planning.ts'

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

  it('copies appearance songs onto the timeline once', () => {
    const base = blankPlanning(seed)
    const withDance = syncAppearanceSongs({
      ...base,
      appearances: [
        {
          id: 'a1',
          names: 'Anniversary dance',
          people: '',
          when: 'After cake',
          notes: '',
          role: 'dance',
          song: 'Perfect',
          artist: 'Ed Sheeran',
          link: '',
          walkUp: false,
        },
      ],
    })
    const custom = withDance.timeline.find((row) => row.id === 'dance-a1')
    assert.ok(custom)
    assert.equal(custom.song, 'Perfect')
    assert.equal(custom.songFrom, 'a1')
    assert.equal(custom.presetKey, '')
    const shared = syncAppearanceSongs({
      ...withDance,
      entranceSongMode: 'one',
      entranceSong: { song: 'Signed', artist: 'Sealed', link: '' },
    })
    const couple = shared.timeline.find(
      (row) => row.presetKey === 'entrance-couple',
    )
    const party = shared.timeline.find(
      (row) => row.presetKey === 'entrance-party',
    )
    assert.ok(couple)
    assert.ok(party)
    assert.equal(couple.song, 'Signed')
    assert.equal(couple.songFrom, 'entrance')
    assert.equal(party.songFrom, 'entrance')
    assert.equal(
      shared.timeline.find((row) => row.id === 'dance-a1')?.song,
      'Perfect',
    )
    const speeches = shared.timeline.find((row) => row.presetKey === 'speeches')
    assert.equal(speeches?.song, '')
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

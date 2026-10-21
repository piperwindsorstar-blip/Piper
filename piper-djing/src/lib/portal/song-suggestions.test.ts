import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  rankSuggestions,
  songsFromPlans,
  suggestionHeading,
} from './song-suggestions.ts'

const past = {
  slug: 'past',
  sample: false,
  timeline: [
    song('guest-arrival', 'Canon in D', 'Pachelbel'),
    song('recessional', 'All You Need Is Love', 'The Beatles'),
    song('first-dance', 'Perfect', 'Ed Sheeran'),
    song('mother-son', 'My Wish', 'Rascal Flatts'),
    song('dinner', 'At Last', 'Etta James'),
    song('guest-arrival', '', ''),
  ],
}

describe('song suggestions', () => {
  it('pools ceremony songs and leaves the other moments out', () => {
    const hits = rankSuggestions('bridal-party', songsFromPlans([past], 'now'))
    assert.deepEqual(
      hits.map((hit) => hit.title),
      ['All You Need Is Love', 'Canon in D'],
    )
    assert.equal(
      suggestionHeading('bridal-party'),
      "Other couples' ceremony songs so far",
    )
  })

  it('ranks a song more couples chose first, then the same moment', () => {
    const second = {
      slug: 'second',
      sample: false,
      timeline: [
        song(
          'bridal-party',
          'Canon in D',
          'Pachelbel',
          'https://music.apple.com/canon',
        ),
      ],
    }
    const hits = rankSuggestions(
      'bridal-party',
      songsFromPlans([past, second], 'now'),
    )
    assert.equal(hits[0]?.title, 'Canon in D')
    assert.equal(hits[0]?.link, 'https://music.apple.com/canon')
    assert.equal(hits[1]?.title, 'All You Need Is Love')
  })

  it('keeps first dance and parent dances in their own lists', () => {
    const chosen = songsFromPlans([past], 'now')
    assert.deepEqual(
      rankSuggestions('first-dance', chosen).map((hit) => hit.title),
      ['Perfect'],
    )
    assert.deepEqual(
      rankSuggestions('father-daughter', chosen).map((hit) => hit.title),
      ['My Wish'],
    )
    assert.equal(rankSuggestions('dinner', chosen).length, 0)
    assert.equal(suggestionHeading('dinner'), '')
  })

  it('skips this couple, samples, hidden moments, and blank titles', () => {
    const chosen = songsFromPlans(
      [
        past,
        {
          slug: 'now',
          sample: false,
          timeline: [song('first-dance', 'Mine', 'Us')],
        },
        {
          slug: 'sample',
          sample: true,
          timeline: [song('first-dance', 'Test Song', 'Nobody')],
        },
        {
          slug: 'hidden',
          sample: false,
          timeline: [
            { ...song('first-dance', 'Hidden Song', 'Nobody'), hidden: true },
          ],
        },
      ],
      'now',
    )
    assert.deepEqual(
      rankSuggestions('first-dance', chosen).map((hit) => hit.title),
      ['Perfect'],
    )
  })
})

function song(presetKey: string, title: string, artist: string, link = '') {
  return { presetKey, song: title, artist, link, hidden: false }
}

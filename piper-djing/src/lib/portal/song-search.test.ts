import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blankPlanning } from '../crm/planning.ts'
import { isSongLink, songHits } from './song-search.ts'
import { timelineQuestions } from './questions.ts'

describe('song search', () => {
  it('treats a web address as a link and a title as a search', () => {
    assert.equal(isSongLink('https://open.spotify.com/track/abc'), true)
    assert.equal(isSongLink('Perfect'), false)
    assert.equal(isSongLink('not a url'), false)
  })

  it('keeps titled songs and drops rows with no name', () => {
    const hits = songHits({
      results: [
        {
          trackName: 'Perfect',
          artistName: 'Ed Sheeran',
          trackViewUrl: 'https://music.apple.com/ca/album/perfect/1',
        },
        { artistName: 'Nobody' },
        'nope',
      ],
    })
    assert.deepEqual(hits, [
      {
        title: 'Perfect',
        artist: 'Ed Sheeran',
        link: 'https://music.apple.com/ca/album/perfect/1',
      },
    ])
  })

  it('asks the couple to search for the song', () => {
    const planning = blankPlanning({
      coupleNames: '',
      email: '',
      phone: '',
      weddingDate: '',
      venueName: '',
    })
    const helper = timelineQuestions(planning)[0]?.helper ?? ''
    assert.equal(
      helper,
      'Search for the song, or paste a YouTube, Spotify or SoundCloud link.',
    )
    assert.doesNotMatch(helper, /Search for it/)
  })
})

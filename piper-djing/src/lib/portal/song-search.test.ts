import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blankPlanning } from '../crm/planning.ts'
import { deezerHits, isSongLink, itunesHits, lookupSongs, songHits } from './song-search.ts'
import { timelineQuestions } from './questions.ts'

describe('song search', { concurrency: false }, () => {
  it('treats a web address as a link and a title as a search', () => {
    assert.equal(isSongLink('https://open.spotify.com/track/abc'), true)
    assert.equal(isSongLink('Perfect'), false)
    assert.equal(isSongLink('not a url'), false)
  })

  it('keeps titled Spotify tracks and drops rows with no name', () => {
    const hits = songHits({
      tracks: {
        items: [
          {
            name: 'Perfect',
            artists: [
              { name: 'Ed Sheeran' },
              { name: 'Beyoncé' },
              { name: 'Andrea Bocelli' },
              { name: 'Skipped' },
            ],
            external_urls: {
              spotify: 'https://open.spotify.com/track/perfect',
            },
          },
          {
            name: 'Photograph',
            artists: [{ name: 'Ed Sheeran' }],
          },
          { artists: [{ name: 'Nobody' }] },
          'nope',
          {
            name: 'x'.repeat(200),
            artists: [{ name: 'y'.repeat(200) }],
            external_urls: {
              spotify: 'https://open.spotify.com/' + 'z'.repeat(400),
            },
          },
        ],
      },
    })
    assert.equal(hits.length, 3)
    assert.deepEqual(hits[0], {
      title: 'Perfect',
      artist: 'Ed Sheeran, Beyoncé, Andrea Bocelli',
      link: 'https://open.spotify.com/track/perfect',
    })
    assert.deepEqual(hits[1], {
      title: 'Photograph',
      artist: 'Ed Sheeran',
      link: '',
    })
    assert.equal(hits[2]?.title.length, 120)
    assert.equal(hits[2]?.artist.length, 120)
    assert.equal(hits[2]?.link.length, 300)
  })

  it('stops after six tracks', () => {
    const hits = songHits({
      tracks: {
        items: Array.from({ length: 8 }, (_item, index) => ({
          name: `Song ${index}`,
          artists: [{ name: 'Artist' }],
          external_urls: { spotify: `https://open.spotify.com/track/${index}` },
        })),
      },
    })
    assert.equal(hits.length, 6)
    assert.equal(hits[5]?.title, 'Song 5')
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
  })

  it('skips the network for a link, a short query, and missing credentials', async () => {
    const previousFetch = globalThis.fetch
    const previousId = process.env.SPOTIFY_CLIENT_ID
    const previousSecret = process.env.SPOTIFY_CLIENT_SECRET
    delete process.env.SPOTIFY_CLIENT_ID
    delete process.env.SPOTIFY_CLIENT_SECRET
    let calls = 0
    globalThis.fetch = () => {
      calls += 1
      throw new Error('network')
    }
    try {
      assert.deepEqual(
        await lookupSongs('https://open.spotify.com/track/abc'),
        [],
      )
      assert.deepEqual(await lookupSongs('P'), [])
      assert.equal(calls, 0)
      // No Spotify keys: Apple, then Deezer, are tried; failures are just no hits.
      assert.deepEqual(await lookupSongs('Perfect'), [])
      assert.equal(calls, 2)
    } finally {
      globalThis.fetch = previousFetch
      restoreEnv('SPOTIFY_CLIENT_ID', previousId)
      restoreEnv('SPOTIFY_CLIENT_SECRET', previousSecret)
    }
  })

  it('searches Spotify tracks and reuses the access token', async () => {
    const previousFetch = globalThis.fetch
    const previousId = process.env.SPOTIFY_CLIENT_ID
    const previousSecret = process.env.SPOTIFY_CLIENT_SECRET
    const clientId = `client-${Date.now()}`
    process.env.SPOTIFY_CLIENT_ID = clientId
    process.env.SPOTIFY_CLIENT_SECRET = 'client-secret'
    const calls: string[] = []
    globalThis.fetch = async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input)
      calls.push(`${init?.method ?? 'GET'} ${url}`)
      if (url.startsWith('https://accounts.spotify.com/api/token')) {
        const header = new Headers(init?.headers).get('authorization') ?? ''
        assert.equal(header, `Basic ${btoa(`${clientId}:client-secret`)}`)
        return Response.json({ access_token: 'token-1', expires_in: 3600 })
      }
      const header = new Headers(init?.headers).get('authorization') ?? ''
      assert.equal(header, 'Bearer token-1')
      const parsed = new URL(url)
      assert.equal(parsed.searchParams.get('type'), 'track')
      assert.equal(parsed.searchParams.get('market'), 'CA')
      assert.equal(parsed.searchParams.get('limit'), '6')
      assert.equal(parsed.searchParams.get('q'), 'Perfect')
      return Response.json({
        tracks: {
          items: [
            {
              name: 'Perfect',
              artists: [{ name: 'Ed Sheeran' }],
              external_urls: {
                spotify: 'https://open.spotify.com/track/perfect',
              },
            },
          ],
        },
      })
    }
    try {
      const first = await lookupSongs('Perfect')
      const second = await lookupSongs('Perfect')
      assert.equal(calls.filter((call) => call.startsWith('POST')).length, 1)
      assert.equal(calls.filter((call) => call.startsWith('GET')).length, 2)
      assert.deepEqual(first, [
        {
          title: 'Perfect',
          artist: 'Ed Sheeran',
          link: 'https://open.spotify.com/track/perfect',
        },
      ])
      assert.deepEqual(second, first)
    } finally {
      globalThis.fetch = previousFetch
      restoreEnv('SPOTIFY_CLIENT_ID', previousId)
      restoreEnv('SPOTIFY_CLIENT_SECRET', previousSecret)
    }
  })
})

describe('deezer song search', () => {
  it('reads Deezer tracks', () => {
    assert.deepEqual(
      deezerHits({ data: [{ title: 'At Last', artist: { name: 'Etta James' }, link: 'https://www.deezer.com/track/1' }, { title: 'At Last', artist: { name: 'Etta James' }, link: 'https://www.deezer.com/track/2' }, { title: 'x' }] }),
      [{ title: 'At Last', artist: 'Etta James', link: 'https://www.deezer.com/track/1' }],
    )
  })
})

describe('apple song search', { concurrency: false }, () => {
  it('reads Apple results, drops repeats and keeps only https links', () => {
    const hits = itunesHits({
      results: [
        { trackName: 'At Last', artistName: 'Etta James', trackViewUrl: 'https://music.apple.com/ca/album/at-last/1' },
        { trackName: 'At Last', artistName: 'Etta James', trackViewUrl: 'https://music.apple.com/ca/album/at-last/2' },
        { trackName: 'At Last', artistName: 'Beyoncé', trackViewUrl: 'javascript:alert(1)' },
        { artistName: 'Nobody' },
      ],
    })
    assert.deepEqual(hits, [
      { title: 'At Last', artist: 'Etta James', link: 'https://music.apple.com/ca/album/at-last/1' },
      { title: 'At Last', artist: 'Beyoncé', link: '' },
    ])
  })

  it('falls back to Apple when Spotify is not set up', async () => {
    const previousFetch = globalThis.fetch
    const previousId = process.env.SPOTIFY_CLIENT_ID
    const previousSecret = process.env.SPOTIFY_CLIENT_SECRET
    delete process.env.SPOTIFY_CLIENT_ID
    delete process.env.SPOTIFY_CLIENT_SECRET
    const urls: string[] = []
    globalThis.fetch = async (input: RequestInfo | URL) => {
      urls.push(String(input))
      return Response.json({
        results: [{ trackName: 'At Last', artistName: 'Etta James', trackViewUrl: 'https://music.apple.com/x' }],
      })
    }
    try {
      const hits = await lookupSongs('at last etta')
      assert.equal(urls.length, 1)
      const url = new URL(urls[0] ?? '')
      assert.equal(url.hostname, 'itunes.apple.com')
      assert.equal(url.searchParams.get('term'), 'at last etta')
      assert.equal(url.searchParams.get('entity'), 'song')
      assert.deepEqual(hits, [{ title: 'At Last', artist: 'Etta James', link: 'https://music.apple.com/x' }])
    } finally {
      globalThis.fetch = previousFetch
      restoreEnv('SPOTIFY_CLIENT_ID', previousId)
      restoreEnv('SPOTIFY_CLIENT_SECRET', previousSecret)
    }
  })
})

function restoreEnv(
  name: 'SPOTIFY_CLIENT_ID' | 'SPOTIFY_CLIENT_SECRET',
  value: string | undefined,
) {
  if (value === undefined) delete process.env[name]
  else process.env[name] = value
}

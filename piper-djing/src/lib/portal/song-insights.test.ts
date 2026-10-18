import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blankPlanning } from '../crm/planning.ts'
import type { Planning } from '../crm/planning.ts'
import { songInsights, songsCsv } from './song-insights.ts'
import type { SongPlan } from './song-insights.ts'

function plan(
  bookingId: number,
  couple: string,
  edit: (planning: Planning) => void,
): SongPlan {
  const planning = blankPlanning({
    coupleNames: couple,
    email: '',
    phone: '',
    weddingDate: '2027-06-05',
    venueName: '',
  })
  edit(planning)
  return { bookingId, couple, eventDate: '2027-06-05', planning }
}

function setMoment(
  planning: Planning,
  key: string,
  patch: Partial<Planning['timeline'][number]>,
) {
  const row = planning.timeline.find((item) => item.presetKey === key)
  assert.ok(row, `moment ${key}`)
  Object.assign(row, patch)
}

const plans = [
  plan(1, 'Kevin & Jasmine', (p) => {
    setMoment(p, 'first-dance', { song: 'Perfect', artist: 'Ed Sheeran' })
    setMoment(p, 'last-dance', { song: "Don't Stop Believin'", artist: 'Journey' })
    p.mustPlayItems = [
      { song: 'September', artist: 'Earth, Wind & Fire', link: '' },
      { song: 'Mr. Brightside', artist: 'The Killers', link: '' },
    ]
    p.doNotPlayItems = [{ song: 'Chicken Dance', artist: '', link: '' }]
    p.genreChips = ['Country', 'Throwbacks']
    p.mood = 'Packed floor after dinner'
    p.guestRequests = 'Play what fits'
    p.dance = 'https://open.spotify.com/playlist/abc'
  }),
  plan(2, 'Lance & Diana', (p) => {
    setMoment(p, 'first-dance', { song: 'perfect', artist: 'ed sheeran' })
    setMoment(p, 'bridal-party', {
      entries: [
        { id: 'partner', name: 'Diana', time: '', song: 'A Thousand Years', artist: 'Christina Perri', link: '' },
      ],
    })
    // A moment they marked "not part of our day" is left out.
    setMoment(p, 'bouquet', { song: 'Single Ladies', artist: 'Beyoncé', hidden: true })
    // The older one-box answer still counts, one song per line.
    p.mustPlay = 'September\nShout'
    p.doNotPlay = 'Chicken Dance'
    p.genreChips = ['country']
    p.guestRequests = 'Our lists only'
  }),
  plan(3, 'Cobi & Cameron', () => {}),
]

describe('desk songs page', () => {
  const insights = songInsights(plans)

  it('counts couples, and which ones have any music answers', () => {
    assert.equal(insights.couples, 3)
    assert.equal(insights.couplesWithMusic, 2)
  })

  it('ranks the same song across couples, ignoring case', () => {
    const top = insights.top[0]
    assert.equal(top?.song, 'Perfect')
    assert.equal(top?.count, 2)
    assert.deepEqual(top?.couples, ['Kevin & Jasmine', 'Lance & Diana'])
    assert.deepEqual(top?.where, ['First dance'])
  })

  it('reads must-play lists, including the older one-box answer', () => {
    const must = insights.picks.filter((row) => row.where === 'Must play')
    assert.deepEqual(
      must.map((row) => `${row.couple}: ${row.song}`),
      [
        'Kevin & Jasmine: September',
        'Kevin & Jasmine: Mr. Brightside',
        'Lance & Diana: September',
        'Lance & Diana: Shout',
      ],
    )
  })

  it('keeps who a processional song is for, and skips hidden moments', () => {
    const walk = insights.picks.find((row) => row.song === 'A Thousand Years')
    assert.equal(walk?.where, 'Wedding party processional')
    assert.equal(walk?.forWho, 'Diana')
    assert.equal(insights.picks.some((row) => row.song === 'Single Ladies'), false)
  })

  it('groups songs by moment in the order of the night', () => {
    assert.deepEqual(
      insights.moments.map((row) => row.name),
      ['Wedding party processional', 'First dance', 'Last dance'],
    )
  })

  it('tallies do-not-play, genres and guest-request choices', () => {
    assert.equal(insights.topDoNotPlay[0]?.song, 'Chicken Dance')
    assert.equal(insights.topDoNotPlay[0]?.count, 2)
    assert.deepEqual(insights.genres[0], { name: 'Country', count: 2 })
    assert.deepEqual(
      insights.guestRequests.map((row) => row.choice).sort(),
      ['Our lists only', 'Play what fits'],
    )
  })

  it('keeps each couple’s vibe and playlists', () => {
    const kevin = insights.perCouple.find((row) => row.bookingId === 1)
    assert.equal(kevin?.vibe, 'Packed floor after dinner')
    assert.deepEqual(kevin?.playlists, [
      { name: 'Dance', link: 'https://open.spotify.com/playlist/abc' },
    ])
  })

  it('writes a spreadsheet that is safe to open', () => {
    const csv = songsCsv(
      songInsights([
        plan(9, 'Ana & Bo', (p) => {
          p.mustPlayItems = [{ song: '=HYPERLINK("x")', artist: 'Earth, Wind & Fire', link: '' }]
        }),
      ]),
    )
    const lines = csv.split('\r\n')
    assert.equal(lines[0], 'Couple,Wedding date,Where,For,Song,Artist,Link')
    assert.equal(
      lines[1],
      `Ana & Bo,2027-06-05,Must play,,"'=HYPERLINK(""x"")","Earth, Wind & Fire",`,
    )
  })
})

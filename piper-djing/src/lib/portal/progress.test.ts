import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blankPlanning } from '../crm/planning.ts'
import {
  daysUntil,
  firstUnanswered,
  questionAnswered,
  sectionProgress,
  shiftIso,
} from './progress.ts'
import { sectionQuestions } from './questions.ts'

const seed = {
  coupleNames: '',
  email: '',
  phone: '',
  weddingDate: '',
  venueName: '',
}

describe('portal progress', () => {
  it('counts visible answers and skips hidden moments and time-only rows', () => {
    const planning = blankPlanning(seed)
    assert.deepEqual(
      sectionQuestions(planning, 'details').map((question) => question.id),
      [
        'weddingDate',
        'coupleNames',
        'lastName',
        'email',
        'phone',
        'guestCount',
        'venueName',
        'venuePhone',
        'ceremonyAddress',
        'receptionAddress',
        'plannerEmail',
        'bridesmaids',
        'groomsmen',
        'mc',
        'mcContact',
        'tableForDj',
        'spaceForDj',
        'outside',
        'power',
        'uplightColours',
        'photobooth',
        'requests',
      ],
    )
    assert.deepEqual(
      sectionQuestions(planning, 'music').map((question) => question.id),
      [
        'genres',
        'mood',
        'guestRequests',
        'dedications',
        'mustPlay',
        'doNotPlay',
        'preCeremony',
        'cocktail',
        'dinner',
        'dance',
        'specialPlaylists',
      ],
    )
    assert.equal(sectionProgress(planning, 'timeline').total, 18)
    assert.equal(sectionProgress(planning, 'timeline').answered, 0)
    assert.equal(firstUnanswered(planning)?.id, 'weddingDate')

    const withSong = {
      ...planning,
      mustPlay: 'At Last',
      timeline: planning.timeline.map((row, index) =>
        index === 8
          ? { ...row, link: 'https://open.spotify.com/track/x' }
          : row,
      ),
    }
    const must = sectionQuestions(withSong, 'music').find(
      (question) => question.id === 'mustPlay',
    )
    assert.ok(must)
    assert.equal(questionAnswered(withSong, must), true)
    assert.equal(sectionProgress(withSong, 'timeline').answered, 1)

    const timeOnly = {
      ...planning,
      timeline: planning.timeline.map((row, index) =>
        index === 8 ? { ...row, time: '6:10 pm' } : row,
      ),
    }
    assert.equal(sectionProgress(timeOnly, 'timeline').answered, 0)

    const hidden = {
      ...withSong,
      timeline: withSong.timeline.map((row, index) =>
        index === 8 ? { ...row, hidden: true } : row,
      ),
    }
    assert.equal(sectionProgress(hidden, 'timeline').total, 17)
    assert.equal(sectionProgress(hidden, 'timeline').answered, 0)
    assert.equal(daysUntil('2026-10-11', '2026-10-16'), 5)
    assert.equal(daysUntil('2026-10-11', '2026-10-01'), 0)
    assert.equal(shiftIso('2027-06-14', -5), '2027-06-09')
  })
})

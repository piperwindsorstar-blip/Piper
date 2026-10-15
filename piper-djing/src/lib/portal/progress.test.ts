import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { blankPlanning } from '../crm/planning.ts'
import {
  answeredLabel,
  daysUntil,
  extrasProgress,
  firstUnanswered,
  overallProgress,
  withSkipped,
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
        'mcToldFindDj',
        'tableForDj',
        'spaceForDj',
        'outside',
        'power',
        'uplightColours',
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
    assert.equal(sectionProgress(planning, 'timeline').total, 15)
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
    assert.equal(sectionProgress(hidden, 'timeline').total, 14)
    assert.equal(sectionProgress(hidden, 'timeline').answered, 0)
    assert.equal(daysUntil('2026-10-11', '2026-10-16'), 5)
    assert.equal(daysUntil('2026-10-11', '2026-10-01'), 0)
    assert.equal(shiftIso('2027-06-14', -5), '2027-06-09')
  })

  it('passes over skipped and optional questions on Continue, and leaves extras out of the count', () => {
    const planning = blankPlanning({
      coupleNames: 'Roxana and Ibu',
      email: '',
      phone: '',
      weddingDate: '2026-10-29',
      venueName: '',
    })
    const first = firstUnanswered(planning)
    assert.ok(first)
    const skipped = withSkipped(planning, first.id)
    assert.notEqual(firstUnanswered(skipped)?.id, first.id)
    assert.equal(firstUnanswered(skipped, {}, { includeSkipped: true })?.id, first.id)
    assert.equal(withSkipped(skipped, first.id), skipped)
    const all = overallProgress(planning)
    const extras = extrasProgress(planning)
    assert.equal(extras.total, 9)
    assert.ok(all.total > 0)
    const details = sectionProgress(planning, 'details')
    assert.equal(details.total, 21 - 3)
  })
  it('labels required answers first and counts extras on their own', () => {
    const planning = blankPlanning(seed)
    const label = answeredLabel(planning)
    const total = overallProgress(planning).total
    const extras = extrasProgress(planning).total
    assert.equal(label, `0 of ${total} answered · ${extras} extras`)
  })
})

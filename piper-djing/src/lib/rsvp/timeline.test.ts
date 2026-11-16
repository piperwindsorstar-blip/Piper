import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  cleanTime,
  guestMoments,
  orderedMoments,
  parseTimeline,
  sampleDay,
  timeLabel,
  timelineCsv,
  validateTimeline,
} from './timeline.ts'
import type { Moment, Timeline } from './timeline.ts'

function moment(time: string, title: string, guests = true): Moment {
  return { id: `${time}-${title}`, time, title, location: '', note: '', guests }
}

/** Mark & Mya's day, entered out of order. */
function markAndMya(): Timeline {
  return {
    manualOrder: false,
    moments: [
      moment('01:00', 'Last song'),
      moment('16:00', 'Ceremony'),
      moment('17:00', 'Family photos', false),
      moment('16:45', 'Cocktail hour'),
      moment('18:00', 'Grand entrance'),
      moment('18:15', 'Dinner'),
      moment('19:30', 'First dance'),
      moment('19:40', 'Speeches'),
      moment('20:00', 'Open dancing'),
    ],
  }
}

describe('times', () => {
  it('reads the usual ways of writing a time', () => {
    assert.equal(cleanTime('16:00'), '16:00')
    assert.equal(cleanTime('4:00 PM'), '16:00')
    assert.equal(cleanTime('4pm'), '16:00')
    assert.equal(cleanTime('12:15 a.m.'), '00:15')
    assert.equal(cleanTime('12 pm'), '12:00')
    assert.equal(cleanTime('25:00'), '')
    assert.equal(cleanTime('soon'), '')
    assert.equal(timeLabel('01:00'), '1:00 AM')
    assert.equal(timeLabel('19:40'), '7:40 PM')
  })
})

describe('order of the day', () => {
  it('sorts by time with after-midnight moments last', () => {
    const titles = orderedMoments(markAndMya()).map((item) => item.title)
    assert.deepEqual(titles, [
      'Ceremony',
      'Cocktail hour',
      'Family photos',
      'Grand entrance',
      'Dinner',
      'First dance',
      'Speeches',
      'Open dancing',
      'Last song',
    ])
  })

  it('keeps the couple order when they reorder by hand', () => {
    const day = markAndMya()
    day.manualOrder = true
    assert.equal(orderedMoments(day)[0]?.title, 'Last song')
  })
})

describe('what guests see', () => {
  it('leaves private moments out and fills in the venue', () => {
    const shown = guestMoments(markAndMya(), 'Cambridge Mill')
    assert.equal(shown.length, 8)
    assert.ok(!shown.some((item) => item.title === 'Family photos'))
    assert.equal(shown[0]?.time, '4:00 PM')
    assert.equal(shown[0]?.location, 'Cambridge Mill')
    assert.equal(shown.at(-1)?.title, 'Last song')
  })

  it('shows nothing until a guest-visible moment exists', () => {
    const day: Timeline = {
      manualOrder: false,
      moments: [moment('17:00', 'Family photos', false)],
    }
    assert.deepEqual(guestMoments(day, 'Venue'), [])
  })
})

describe('saving', () => {
  it('needs a time and a title on every moment', () => {
    const missingTime = validateTimeline({
      manualOrder: false,
      moments: [moment('', 'Ceremony')],
    })
    assert.equal(missingTime.ok, false)
    const missingTitle = validateTimeline({
      manualOrder: false,
      moments: [moment('16:00', ' ')],
    })
    assert.equal(missingTitle.ok, false)
    const fine = validateTimeline(markAndMya())
    assert.ok(fine.ok)
    if (fine.ok) assert.equal(fine.timeline.moments[0]?.title, 'Ceremony')
  })

  it('reads back stored moments, private flag included', () => {
    const parsed = parseTimeline(JSON.parse(JSON.stringify(markAndMya())))
    assert.equal(parsed.moments.length, 9)
    assert.equal(
      parsed.moments.find((item) => item.title === 'Family photos')?.guests,
      false,
    )
  })

  it('offers an editable sample day', () => {
    let next = 0
    const day = sampleDay(() => `s${(next += 1)}`)
    assert.ok(day.length >= 8)
    assert.ok(day.some((item) => !item.guests))
    assert.ok(validateTimeline({ manualOrder: false, moments: day }).ok)
  })
})

describe('the timeline CSV', () => {
  it('includes private moments for the couple and DJ', () => {
    const csv = timelineCsv(markAndMya(), 'Cambridge Mill')
    const lines = csv.replace(/^﻿/, '').split('\r\n')
    assert.equal(lines[0], 'Time,Moment,Location,Note,Shown to guests')
    assert.equal(lines[1], '4:00 PM,Ceremony,Cambridge Mill,,yes')
    assert.ok(lines.includes('5:00 PM,Family photos,Cambridge Mill,,no (private)'))
    assert.equal(lines.at(-1), '1:00 AM,Last song,Cambridge Mill,,yes')
  })
})

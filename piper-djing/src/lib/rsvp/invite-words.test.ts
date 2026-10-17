import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  BOX_MAX,
  BOX_TEXT_MAX,
  DEFAULT_WORDING,
  boxesAt,
  LINE_DEFAULTS,
  placedLines,
  NOTE_MAX,
  inviteDate,
  monogramLetters,
  numberWords,
  ordinalWords,
  parseWording,
  shortTime,
  timeWords,
} from './invite-words.ts'
import { inviteView, mapLink, startTime } from './invite.ts'
import { sampleWedding } from './demo.ts'
import { parseWedding } from './model.ts'

describe('invitation words', () => {
  it('writes the date with the day and year as numbers', () => {
    const date = inviteDate('2027-06-12')
    assert.ok(date)
    assert.equal(date.weekday, 'Saturday')
    assert.equal(date.plain, 'June 12, 2027')
    assert.equal(date.full, 'Saturday, June 12, 2027')
    assert.deepEqual(date.parts, { month: 'JUN', day: '12', year: '2027', weekdayShort: 'SAT' })
    // days and years are always numbers
    assert.equal(inviteDate('2026-10-31')?.full, 'Saturday, October 31, 2026')
    assert.equal(inviteDate('2027-03-22')?.full, 'Monday, March 22, 2027')
    assert.equal(inviteDate('2027-02-30'), null)
    assert.equal(inviteDate('soon'), null)
    assert.equal(ordinalWords(20), 'twentieth')
    assert.equal(numberWords(2030), 'two thousand thirty')
    assert.equal(numberWords(2100), 'two thousand one hundred')
  })

  it('writes times out in words, and short for the modern styles', () => {
    assert.equal(timeWords('4:00 PM'), "four o'clock in the afternoon")
    assert.equal(timeWords('4:30 pm'), 'half past four in the afternoon')
    assert.equal(timeWords('5:15 PM'), 'quarter past five in the evening')
    assert.equal(timeWords('11:45 AM'), 'quarter to twelve in the morning')
    assert.equal(timeWords('12:00 PM'), 'twelve noon')
    assert.equal(timeWords('6:20 PM'), 'twenty minutes past six in the evening')
    assert.equal(timeWords('sunset'), 'sunset')
    assert.equal(shortTime('4:00 PM'), '4 pm')
    assert.equal(shortTime('4:30 PM'), '4:30 pm')
  })

  it('makes a monogram from the first letters', () => {
    assert.deepEqual(monogramLetters('sarah', 'Michael'), ['S', 'M'])
    assert.deepEqual(monogramLetters(' Éloïse ', 'jo'), ['É', 'J'])
    assert.deepEqual(monogramLetters('', 'Jo'), ['', 'J'])
  })

  it('reads stored wording, keeping a line the couple cleared', () => {
    assert.deepEqual(parseWording(undefined), DEFAULT_WORDING)
    const custom = parseWording({ host: '', request: '  invite   you  ', after: 'Reception to follow', note: 'a\r\n\n\n\nb' })
    assert.equal(custom.host, '')
    assert.equal(custom.request, 'invite you')
    assert.equal(custom.after, 'Reception to follow')
    assert.equal(custom.note, 'a\n\nb')
    // the line under the names is never empty
    assert.equal(parseWording({ request: '' }).request, DEFAULT_WORDING.request)
    assert.equal(parseWording({ note: 'x'.repeat(500) }).note.length, NOTE_MAX)
    assert.equal(parseWording({ host: 42 }).host, DEFAULT_WORDING.host)
  })

  it('keeps up to four of the couple text boxes, each checked', () => {
    const wording = parseWording({
      boxes: [
        { id: 'a', text: '  Cocktail attire  ', size: 'large', place: 'top' },
        { id: 'a', text: 'Adults only', size: 'huge', place: 'sky' },
        { id: 'c<script>', text: 'x'.repeat(400), size: 'small', place: 'bottom' },
        { id: 'd', text: '', size: 'normal', place: 'details' },
        { id: 'e', text: 'one too many', size: 'normal', place: 'details' },
        'junk',
      ],
    })
    assert.equal(wording.boxes.length, BOX_MAX)
    assert.deepEqual(wording.boxes[0], { id: 'a', text: 'Cocktail attire', size: 'large', place: 'top' })
    // a repeated id gets a fresh one; an unknown size or place falls back
    assert.notEqual(wording.boxes[1].id, 'a')
    assert.equal(wording.boxes[1].size, 'normal')
    assert.equal(wording.boxes[1].place, 'details')
    assert.equal(wording.boxes[2].id, 'cscript')
    assert.equal(wording.boxes[2].text.length, BOX_TEXT_MAX)
    // an empty box is kept while the couple writes it, but never printed
    assert.equal(wording.boxes[3].text, '')
    assert.deepEqual(boxesAt(wording, 'details').map((box) => box.text), ['Adults only'])
    assert.deepEqual(boxesAt(wording, 'top').map((box) => box.text), ['Cocktail attire'])
    assert.deepEqual(parseWording({ boxes: 'no' }).boxes, [])
  })

  it('lets the filled-in lines move and change style too', () => {
    assert.deepEqual(parseWording({}).lines, LINE_DEFAULTS)
    const wording = parseWording({
      host: 'Together with their families',
      note: 'See you there',
      lines: { host: { size: 'large', place: 'bottom' }, note: { size: 'shout', place: 'nowhere' } },
      boxes: [{ id: 'host', text: 'Parking out back', size: 'small', place: 'bottom' }],
    })
    assert.deepEqual(wording.lines.host, { size: 'large', place: 'bottom' })
    assert.deepEqual(wording.lines.note, LINE_DEFAULTS.note)
    assert.deepEqual(wording.lines.request, LINE_DEFAULTS.request)
    const bottom = placedLines(wording, 'bottom')
    assert.deepEqual(bottom.map((line) => line.text), ['Together with their families', 'See you there', 'Parking out back'])
    assert.notEqual(bottom[2].id, 'host')
    assert.equal(placedLines(wording, 'top').length, 0)
    assert.equal(placedLines({ ...wording, after: '' }, 'details').length, 0)
  })
})

describe('the invitation a guest sees', () => {
  it('builds the card from the wedding, with the party on the envelope', () => {
    const wedding = sampleWedding()
    const view = inviteView(wedding, { addressee: '  The Miller Family ' })
    assert.equal(view.addressee, 'The Miller Family')
    assert.deepEqual(view.letters, ['S', 'M'])
    assert.equal(view.timeWords, "four o'clock in the afternoon")
    assert.equal(view.timeShort, '4 pm')
    assert.equal(view.replyBy, 'May 8')
    assert.equal(view.venue, 'The Glenhyrst Gardens, Brantford ON')
    assert.equal(view.address, '20 Ava Rd, Brantford ON')
    assert.equal(view.photo, null)
    assert.match(mapLink(view), /^https:\/\/www\.google\.com\/maps\/search\/\?api=1&query=The%20Glenhyrst/)
  })

  it('takes the first time of the day, and hides an address that repeats the venue', () => {
    assert.equal(startTime({ events: [{ enabled: false, time: '2:00 PM' }], schedule: [{ time: '6:30 PM – 1:00 AM' }] }), '6:30 PM')
    const wedding = sampleWedding()
    wedding.address = 'The Glenhyrst Gardens'
    assert.equal(inviteView(wedding).address, '')
  })

  it('keeps the invitation choices on a stored wedding', () => {
    const wedding = sampleWedding()
    assert.equal(wedding.tint, 0)
    assert.equal(wedding.monogram, true)
    assert.equal(wedding.envelope, true)
    const stored = parseWedding(
      { ...wedding, template: 'after-dark', tint: 2, monogram: false, envelope: false, wording: { host: '', request: 'are getting married', after: '', note: 'See you there' } },
      'sarah-and-michael',
    )
    assert.ok(stored)
    assert.equal(stored.template, 'after-dark')
    assert.equal(stored.tint, 2)
    assert.equal(stored.monogram, false)
    assert.equal(stored.envelope, false)
    assert.equal(stored.wording.request, 'are getting married')
    assert.equal(stored.wording.note, 'See you there')
    // an older record with none of these reads with the defaults
    const old = parseWedding({ ...wedding, tint: undefined, wording: undefined, monogram: undefined, envelope: undefined }, 'x')
    assert.ok(old)
    assert.equal(old.tint, 0)
    assert.deepEqual(old.wording, DEFAULT_WORDING)
    assert.equal(old.monogram, true)
    assert.equal(old.envelope, true)
  })
})

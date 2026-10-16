import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_WORDING,
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
  it('writes dates the way a printed invitation does', () => {
    const date = inviteDate('2027-06-12')
    assert.ok(date)
    assert.equal(date.weekday, 'Saturday')
    assert.equal(date.dayWords, 'the twelfth of June')
    assert.equal(date.yearWords, 'two thousand twenty-seven')
    assert.equal(date.plain, 'June 12, 2027')
    assert.deepEqual(date.parts, { month: 'JUN', day: '12', year: '2027', weekdayShort: 'SAT' })
    assert.equal(inviteDate('2026-10-31')?.dayWords, 'the thirty-first of October')
    assert.equal(inviteDate('2027-03-22')?.dayWords, 'the twenty-second of March')
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

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sampleWedding } from './demo.ts'
import type { LookupResult, RsvpParty } from './model.ts'
import {
  PIPER_RSVP_CENTS,
  STANDALONE_RSVP_CENTS,
  applyHousehold,
  applyPartyDraft,
  catererCsv,
  codesMatch,
  csvCell,
  confirmationLetter,
  coupleReplyAddress,
  coupleSlug,
  findParty,
  foldName,
  invitedEvents,
  noteLookup,
  overviewStats,
  partiesToRemind,
  partiesWaiting,
  parseWedding,
  quoteRsvp,
  repliesLocked,
  rsvpPath,
  songRows,
  splitSong,
} from './model.ts'

function found(result: LookupResult): RsvpParty {
  if (!result.ok) throw new Error(result.reason)
  return result.party
}

function missed(result: LookupResult): string {
  if (result.ok) throw new Error('expected no match')
  return result.reason
}

describe('rsvp price and link', () => {
  it('charges a paid Piper couple $20 and everyone else $30', () => {
    const bookings = [
      {
        email: 'Cobi@example.com',
        sample: false,
        status: 'booked',
        receivedCents: 40000,
      },
      {
        email: 'open@example.com',
        sample: false,
        status: 'open',
        receivedCents: 0,
      },
      {
        email: 'sample@example.com',
        sample: true,
        status: 'booked',
        receivedCents: 40000,
      },
    ]
    assert.deepEqual(quoteRsvp('cobi@example.com', bookings), {
      cents: PIPER_RSVP_CENTS,
      kind: 'piper',
    })
    assert.equal(
      quoteRsvp('open@example.com', bookings).cents,
      STANDALONE_RSVP_CENTS,
    )
    assert.equal(
      quoteRsvp('sample@example.com', bookings).cents,
      STANDALONE_RSVP_CENTS,
    )
    assert.equal(quoteRsvp('new@example.com', bookings).kind, 'standalone')
  })

  it('emails a confirmed RSVP to the couple, not the sign-in address', () => {
    const wedding = sampleWedding()
    wedding.replyEmail = ''
    wedding.email = 'piperpweddingdj@gmail.com'
    assert.equal(coupleReplyAddress(wedding, []), '')
    const saved = parseWedding(
      JSON.parse(JSON.stringify({ ...sampleWedding(), replyEmail: undefined })),
      wedding.slug,
    )
    assert.equal(saved?.replyEmail, '')
    wedding.replyEmail = 'mark@example.com'
    assert.equal(coupleReplyAddress(wedding, []), 'mark@example.com')
    wedding.replyEmail = ''
    assert.equal(
      coupleReplyAddress(wedding, [
        {
          partnerOne: 'Michael',
          partnerTwo: 'Sarah',
          eventDate: wedding.eventDate,
          email: 'couple@example.com',
          sample: false,
        },
      ]),
      'couple@example.com',
    )
    assert.equal(
      coupleReplyAddress(wedding, [
        {
          partnerOne: 'Sarah',
          partnerTwo: 'Michael',
          eventDate: '2020-01-01',
          email: 'other@example.com',
          sample: false,
        },
        {
          partnerOne: 'Sarah',
          partnerTwo: 'Michael',
          eventDate: wedding.eventDate,
          email: 'sample@example.com',
          sample: true,
        },
      ]),
      '',
    )
  })

  it('starts the public link with RSVP', () => {
    const slug = coupleSlug('Sarah', 'Michael')
    assert.equal(slug, 'sarah-and-michael')
    assert.equal(rsvpPath(slug), '/rsvp/sarah-and-michael')
    assert.equal(rsvpPath(slug).startsWith('/rsvp'), true)
    assert.equal(rsvpPath(slug).includes('/w/'), false)
  })
})

describe('rsvp lookup', () => {
  it('returns one party for an exact or alternate name and never a list', () => {
    const wedding = sampleWedding()
    const liz = found(findParty(wedding, 'liz', 'miller'))
    assert.equal(liz.name, 'The Miller Family')
    const bill = found(findParty(wedding, 'Bill', 'Thompson'))
    assert.equal(bill.id, 'thompson')
    assert.equal(findParty(wedding, 'Bill', 'Thomson').ok, false)
    assert.equal(missed(findParty(wedding, 'L', 'Miller')), 'short')
    assert.equal(findParty(wedding, 'Willi', 'Thompson').ok, false)
    const grandma = findParty(wedding, 'Grandma', 'Rose')
    assert.equal(grandma.ok, true)
    const jose = sampleWedding()
    const first = jose.parties[0]
    assert.ok(first)
    first.guests[0].firstName = 'José'
    first.guests[0].lastName = 'García'
    assert.equal(findParty(jose, 'Jose', 'Garcia').ok, true)
    const copy = sampleWedding()
    copy.parties.push({
      ...structuredClone(copy.parties[1]),
      id: 'other',
      token: 'other',
      name: 'Other',
    })
    assert.equal(findParty(copy, 'Ada', 'Okafor').ok, false)
  })

  it('limits lookups and ignores accents in the folded name', () => {
    assert.equal(foldName('José'), 'jose')
    let stamps: number[] = []
    for (let count = 0; count < 8; count += 1) {
      const next = noteLookup(stamps, 1_000)
      assert.equal(next.ok, true)
      stamps = next.stamps
    }
    assert.equal(noteLookup(stamps, 1_000).ok, false)
    assert.equal(codesMatch('sm 2027', 'SM2027'), true)
    assert.equal(codesMatch('NOPE', 'SM2027'), false)
  })
})

describe('rsvp household', () => {
  it('keeps rehearsal details off a party that was not invited', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    const names = invitedEvents(wedding, party).map((event) => event.name)
    assert.deepEqual(names, ['Ceremony & reception', 'Sunday brunch'])
  })

  it('saves one household, drops a plus-one, and locks after the deadline', () => {
    const wedding = sampleWedding()
    const removed = applyHousehold(wedding, 'miller', {
      email: 'liz.miller@example.com',
      note: 'See you there',
      final: true,
      today: '2026-10-11',
      now: '2026-10-11T23:00:00.000Z',
      guests: wedding.parties[0].guests.map((guest) => ({
        id: guest.id,
        replies: guest.replies,
        meal: guest.meal,
        dietary: guest.dietary,
        dietaryNote: '',
        song: guest.songTitle ? `${guest.songTitle} – ${guest.songArtist}` : '',
        plusOneName: '',
      })),
      removePlusOneIds: ['jordan'],
      addPlusOne: null,
    })
    if (!removed.ok) throw new Error(removed.error)
    assert.equal(
      removed.party.guests.some((guest) => guest.id === 'jordan'),
      false,
    )
    assert.equal(removed.party.note, 'See you there')
    const locked = applyHousehold(wedding, 'miller', {
      email: '',
      note: '',
      final: false,
      today: '2027-05-09',
      now: '2027-05-09T12:00:00.000Z',
      guests: [],
      removePlusOneIds: [],
      addPlusOne: null,
    })
    assert.equal(locked.ok, false)
    assert.equal(repliesLocked(wedding, '2027-05-09'), true)
  })

  it('asks for dinner before a final reply', () => {
    const wedding = sampleWedding()
    const saved = applyHousehold(wedding, 'thompson', {
      email: 'william@example.com',
      note: '',
      final: true,
      today: '2026-10-11',
      now: '2026-10-11T23:00:00.000Z',
      guests: [
        {
          id: 'william',
          replies: { ceremony: 'attending' },
          meal: '',
          dietary: [],
          dietaryNote: '',
          song: '',
          plusOneName: '',
        },
      ],
      removePlusOneIds: [],
      addPlusOne: null,
    })
    assert.equal(saved.ok, false)
  })

  it('keeps a separate meal for each guest', () => {
    const wedding = sampleWedding()
    const saved = applyHousehold(wedding, 'okafor', {
      email: 'ada@example.com',
      note: '',
      final: true,
      today: '2026-10-11',
      now: '2026-10-11T23:00:00.000Z',
      guests: [
        {
          id: 'chidi',
          replies: { ceremony: 'attending' },
          meal: 'Prime rib',
          dietary: [],
          dietaryNote: 'Shellfish',
          song: '',
          plusOneName: '',
        },
        {
          id: 'ada',
          replies: { ceremony: 'attending' },
          meal: 'Wild salmon',
          dietary: [],
          dietaryNote: '',
          song: '',
          plusOneName: '',
        },
      ],
      removePlusOneIds: [],
      addPlusOne: null,
    })
    if (!saved.ok) throw new Error(saved.error)
    const meals = saved.party.guests.map((guest) => guest.meal)
    assert.deepEqual(meals, ['Prime rib', 'Wild salmon'])
    assert.equal(saved.party.guests[0]?.dietaryNote, 'Shellfish')
  })

  it('requires a meal before a plus-one reply can be sent', () => {
    const wedding = sampleWedding()
    const blocked = applyHousehold(wedding, 'thompson', {
      email: 'william@example.com',
      note: '',
      final: true,
      today: '2026-10-11',
      now: '2026-10-11T23:00:00.000Z',
      guests: [
        {
          id: 'william',
          replies: { ceremony: 'attending' },
          meal: 'Prime rib',
          dietary: [],
          dietaryNote: '',
          song: '',
          plusOneName: '',
        },
      ],
      removePlusOneIds: [],
      addPlusOne: null,
      plusOnes: [
        {
          id: 'alex',
          hostId: 'william',
          name: 'Alex Kim',
          meal: '',
          dietaryNote: 'Peanuts',
        },
      ],
    })
    assert.equal(blocked.ok, false)
    const saved = applyHousehold(wedding, 'thompson', {
      email: 'william@example.com',
      note: '',
      final: true,
      today: '2026-10-11',
      now: '2026-10-11T23:00:00.000Z',
      guests: [
        {
          id: 'william',
          replies: { ceremony: 'attending' },
          meal: 'Prime rib',
          dietary: [],
          dietaryNote: '',
          song: '',
          plusOneName: '',
        },
      ],
      removePlusOneIds: [],
      addPlusOne: null,
      plusOnes: [
        {
          id: 'alex',
          hostId: 'william',
          name: 'Alex Kim',
          meal: 'Wild salmon',
          dietaryNote: 'Peanuts',
        },
      ],
    })
    if (!saved.ok) throw new Error(saved.error)
    const plus = saved.party.guests.find((guest) => guest.id === 'alex')
    assert.ok(plus)
    assert.equal(plus.isPlusOne, true)
    assert.equal(plus.plusOneOf, 'william')
    assert.equal(plus.meal, 'Wild salmon')
    assert.equal(plus.dietaryNote, 'Peanuts')
    assert.equal(
      overviewStats(saved.wedding, Date.parse('2026-10-11T23:00:00.000Z'))
        .guests,
      sampleWedding().parties.reduce(
        (sum, party) => sum + party.guests.length,
        0,
      ) + 1,
    )
  })
})

describe('rsvp songs, mail, and csv', () => {
  it('dedupes songs and skips people who have not replied', () => {
    const rows = songRows(sampleWedding())
    const september = rows.find((row) => row.title === 'September')
    assert.ok(september)
    assert.equal(september.count, 2)
    assert.equal(september.status, 'must')
    assert.equal(
      rows.some((row) => row.title === 'Wagon Wheel'),
      true,
    )
    assert.equal(
      splitSong('September – Earth, Wind & Fire').artist,
      'Earth, Wind & Fire',
    )
  })

  it('reminds only unanswered parties seven days out', () => {
    const names = partiesToRemind(sampleWedding(), '2027-05-01').map(
      (party) => party.id,
    )
    assert.deepEqual(names, ['thompson'])
    assert.deepEqual(partiesToRemind(sampleWedding(), '2027-05-02'), [])
    assert.deepEqual(
      partiesWaiting(sampleWedding()).map((party) => party.id),
      ['thompson'],
    )
  })

  it('builds a confirmation that stays inside the party', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    const letter = confirmationLetter(
      wedding,
      party,
      'https://piperpweddingdj.services/rsvp/sarah-and-michael/p/miller',
    )
    assert.match(letter.text, /Elizabeth Miller/)
    assert.match(letter.text, /\/rsvp\/sarah-and-michael/)
    assert.doesNotMatch(letter.text, /Okafor/)
  })

  it('prefixes formula cells and round-trips the saved wedding', () => {
    assert.equal(csvCell('=1+1'), "'=1+1")
    assert.equal(csvCell('hello, there'), '"hello, there"')
    const csv = catererCsv(sampleWedding())
    assert.equal(csv.charCodeAt(0), 0xfeff)
    assert.match(csv, /Wild salmon/)
    assert.doesNotMatch(csv, /Rehearsal/)
    const parsed = parseWedding(
      JSON.parse(JSON.stringify(sampleWedding())),
      'sarah-and-michael',
    )
    assert.equal(parsed?.parties.length, 4)
    const renamed = applyPartyDraft(
      sampleWedding(),
      {
        id: 'thompson',
        name: 'Thompson, William',
        email: 'william@example.com',
        plusOneAllowed: true,
        eventIds: ['ceremony', 'nope'],
        guests: [
          {
            id: 'william',
            firstName: 'William',
            lastName: 'Thompson',
            altNames: ['Bill'],
            isChild: false,
            isPlusOne: false,
          },
        ],
      },
      'thompson',
    )
    if (!renamed.ok) throw new Error(renamed.error)
    const party = renamed.wedding.parties.find((item) => item.id === 'thompson')
    assert.ok(party)
    assert.deepEqual(party.eventIds, ['ceremony'])
    const stats = overviewStats(
      sampleWedding(),
      Date.parse('2026-10-11T22:02:00.000Z'),
    )
    assert.equal(stats.attending, 6)
    assert.equal(stats.declined, 1)
    assert.equal(stats.waitingGuests, 1)
  })
})

import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sampleWedding } from './demo.ts'
import {
  ceremonyTime,
  confirmationEmail,
  deadlineSummaryEmail,
  formalDate,
  guestSender,
  invitationEmail,
  partyNames,
  piperPaymentEmail,
  piperQuestionEmail,
  piperSignupEmail,
  reminderEmail,
  replyNoticeEmail,
  shortDate,
  signInEmail,
  venueParts,
  welcomeEmail,
} from './emails.ts'
import { catererCsv, overviewStats } from './model.ts'
import { parsePhoto } from './templates.ts'

const url = 'https://piperpweddingdj.services/rsvp/sarah-and-michael/p/miller'
const dashboard = 'https://piperpweddingdj.services/rsvp/manage'

describe('invitation style', () => {
  it('writes the date with the day and year as numbers', () => {
    assert.equal(formalDate('2027-01-13'), 'Wednesday, January 13, 2027')
    assert.equal(shortDate('2027-01-13'), 'January 13, 2027')
    assert.equal(formalDate('nope'), '')
    assert.equal(shortDate('nope'), '')
  })

  it('splits a venue into a name and a town', () => {
    assert.deepEqual(
      venueParts({ venue: 'The Glenhyrst Gardens, Brantford ON', address: '' }),
      { name: 'The Glenhyrst Gardens', town: 'Brantford ON' },
    )
    assert.deepEqual(
      venueParts({ venue: 'The Hall', address: '1 Main St, Paris ON' }),
      { name: 'The Hall', town: 'Paris ON' },
    )
    assert.equal(ceremonyTime(sampleWedding()), '4:00 PM')
  })

  it('lists every named guest on the invitation line', () => {
    const party = sampleWedding().parties[0]
    assert.ok(party)
    assert.equal(
      partyNames(party),
      'Elizabeth Miller, David Miller, Nora Miller & Jordan Lee',
    )
  })

  it('builds a cream-card invitation with the code and guest names', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    const email = invitationEmail(wedding, party, url)
    assert.equal(email.kind, 'invitation')
    assert.equal(
      email.subject,
      "You're invited · Sarah & Michael · June 12, 2027",
    )
    assert.match(email.html, /#FBF6EC/)
    assert.match(email.html, /border:1px solid/)
    assert.match(email.html, /Georgia/)
    assert.match(email.html, /letter-spacing/)
    assert.match(email.html, /max-width:600px/)
    assert.match(email.html, /brand\/dj-piper-p\.png/)
    assert.match(email.html, new RegExp(url))
    assert.match(email.text, /request the pleasure of your company/)
    assert.match(email.text, /Saturday, June 12, 2027/)
    assert.match(email.text, /Invitation code SM2027/)
    assert.match(email.text, /For: Elizabeth Miller/)
    // no web font is required
    assert.doesNotMatch(email.html, /fonts\.googleapis/)
  })

  it('dresses the card in the couple template', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    const ivory = invitationEmail(wedding, party, url)
    assert.match(ivory.html, /#A8844A/)
    assert.match(ivory.html, /background:#FBF6EC/)
    assert.match(ivory.html, /invite-art\/ivory-0\.png/)
    wedding.template = 'minimal'
    const minimal = invitationEmail(wedding, party, url)
    assert.match(minimal.html, /background:#FFFFFF/)
    assert.match(minimal.html, /border:1px solid #111111/)
    assert.match(minimal.html, /Helvetica/)
    wedding.template = 'blush'
    const blush = invitationEmail(wedding, party, url)
    assert.match(blush.html, /background:#FFF6F3/)
    assert.match(blush.html, /Snell Roundhand/)
    assert.match(blush.html, /&#10047;/)
    wedding.template = 'kraft'
    const kraft = invitationEmail(wedding, party, url)
    assert.match(kraft.html, /background:#E6D7BA/)
    assert.match(kraft.html, /border:2px dashed #BFAE8A/)
    assert.match(kraft.html, /border:1px solid #D3C4A2/)
    wedding.template = 'black-tie'
    const black = invitationEmail(wedding, party, url)
    assert.match(black.html, /background:#0F0F10/)
    assert.match(black.html, /#C9A227/)
    assert.match(black.html, /&#9670;/)
    for (const letter of [ivory, minimal, blush, kraft, black]) {
      assert.doesNotMatch(letter.html, /fonts\.googleapis/)
      assert.match(letter.html, /max-width:600px/)
      assert.match(letter.html, /Open your invitation<\/a>/)
    }
  })

  it('wears the new styles, the colourway and the couple wording', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    for (const template of ['deco', 'garden', 'after-dark'] as const) {
      wedding.template = template
      const letter = invitationEmail(wedding, party, url)
      assert.match(letter.html, new RegExp(`invite-art/${template}-0\\.png`))
      assert.match(letter.html, /max-width:600px/)
    }
    wedding.template = 'ivory'
    wedding.tint = 1
    const sage = invitationEmail(wedding, party, url)
    assert.match(sage.html, /#7D8C6A/)
    assert.match(sage.html, /invite-art\/ivory-1\.png/)
    wedding.wording = {
      host: 'With joyful hearts',
      request: 'invite you to celebrate their wedding',
      after: '',
      note: 'Bring your dancing shoes!',
    }
    const words = invitationEmail(wedding, party, url)
    assert.match(words.html, /With joyful hearts/)
    assert.match(words.html, /invite you to celebrate their wedding/)
    assert.match(words.html, /Bring your dancing shoes!/)
    assert.doesNotMatch(words.html, /Dinner and dancing to follow/)
    assert.match(words.html, /Saturday, June 12, 2027/)
    assert.doesNotMatch(words.html, /twelfth|two thousand/)
    assert.match(words.html, /four o&#39;clock in the afternoon|four o'clock in the afternoon/)
    assert.match(words.html, />S &amp; M</)
    assert.match(words.text, /With joyful hearts/)
    assert.match(words.text, /Bring your dancing shoes!/)
    wedding.wording = {
      ...wedding.wording,
      boxes: [
        { id: 'a', text: 'Cocktail attire', size: 'large', place: 'top' },
        { id: 'b', text: 'Adults only, please', size: 'normal', place: 'details' },
        { id: 'c', text: '#SarahAndMichael', size: 'small', place: 'bottom' },
        { id: 'd', text: '', size: 'normal', place: 'details' },
      ],
    }
    const boxed = invitationEmail(wedding, party, url)
    assert.match(boxed.html, /Cocktail attire/)
    assert.match(boxed.html, /Adults only, please/)
    assert.match(boxed.html, /#SarahAndMichael/)
    assert.ok(boxed.html.indexOf('Cocktail attire') < boxed.html.indexOf('Sarah &amp; Michael</p>'))
    assert.match(boxed.text, /Cocktail attire\nSarah & Michael/)
    assert.match(boxed.text, /Adults only, please/)
    wedding.monogram = false
    assert.doesNotMatch(invitationEmail(wedding, party, url).html, />S &amp; M</)
  })

  it('puts the couple photo at the top of the invitation once they add one', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    assert.doesNotMatch(
      invitationEmail(wedding, party, url).html,
      /\/api\/rsvp\//,
    )
    wedding.photo = {
      version: '42',
      width: 1000,
      height: 1000,
      bytes: 120_000,
    }
    const withPhoto = invitationEmail(wedding, party, url)
    assert.match(withPhoto.html, /\/api\/rsvp\/sarah-and-michael\/photo\?v=42/)
    assert.match(withPhoto.html, /alt="Sarah &amp; Michael photo"/)
    // a square photo is drawn square on the 600px card
    assert.match(withPhoto.html, /width="600" height="600"/)
    // the template still reads complete without one
    const plain = sampleWedding()
    plain.photo = null
    assert.match(invitationEmail(plain, party, url).html, /background:#FBF6EC/)
  })

  it('shows the whole photo, never cropped, on every letter', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    // a tall portrait: 1000 x 1250
    wedding.photo = {
      version: '77',
      width: 1000,
      height: 1250,
      bytes: 90_000,
    }
    const letters = [
      invitationEmail(wedding, party, url),
      reminderEmail(wedding, party, url),
      confirmationEmail(wedding, party, url),
      welcomeEmail(wedding, {
        amountLabel: '$20.00',
        dashboardUrl: url,
        guestUrl: url,
      }),
    ]
    for (const letter of letters) {
      // the whole photo, and never a shaped rendition
      assert.match(letter.html, /\/api\/rsvp\/sarah-and-michael\/photo\?v=77/)
      assert.doesNotMatch(letter.html, /shape=/)
      assert.doesNotMatch(letter.html, /border-radius:50%|border-radius:500px/)
      // a 1000x1250 portrait caps at 800 high and stays in proportion
      assert.match(letter.html, /width="600" height="750"/)
      assert.match(letter.html, /max-width:100%|width:100%/)
    }
  })

  it('caps a very tall portrait at 800px high and scales it down', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    wedding.photo = {
      version: '9',
      width: 900,
      height: 2400,
      bytes: 90_000,
    }
    const html = invitationEmail(wedding, party, url).html
    assert.match(html, /width="300" height="800"/)
    assert.doesNotMatch(html, /height="2400"/)
  })

  it('never asks for a shaped rendition, whatever a record held before', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    // exactly what the store hands back for an old arch upload with a crop
    wedding.photo = parsePhoto({
      shape: 'arch',
      version: '3',
      width: 1000,
      height: 1250,
      bytes: 90_000,
      cropVersion: '3',
      crop: { zoom: 2, panX: 1, panY: -1 },
    })
    const html = invitationEmail(wedding, party, url).html
    assert.match(html, /\/api\/rsvp\/sarah-and-michael\/photo\?v=3/)
    assert.doesNotMatch(html, /shape=/)
    assert.match(html, /width="600" height="750"/)
  })
})

describe('the other guest emails', () => {
  it('names the couple on the confirmation, never "the Piper"', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    const email = confirmationEmail(wedding, party, url)
    assert.equal(email.subject, 'Your RSVP for Sarah & Michael is in')
    assert.match(email.text, /Thank you, Elizabeth!/)
    assert.match(
      email.text,
      /Elizabeth Miller — Attending · Wild salmon · Gluten-free/,
    )
    assert.match(email.text, /Change your reply/)
    assert.doesNotMatch(email.text, /the Piper/i)
  })

  it('reminds with the deadline in the subject', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[3]
    assert.ok(party)
    const email = reminderEmail(wedding, party, url)
    assert.equal(
      email.subject,
      'A gentle reminder · RSVP for Sarah & Michael by May 8',
    )
    assert.match(email.text, /still hoping to hear from you/)
    assert.match(email.html, new RegExp(url))
  })

  it('tells the couple who replied and the running totals', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    const email = replyNoticeEmail(
      wedding,
      party,
      overviewStats(wedding, Date.now()),
      dashboard,
    )
    assert.equal(email.subject, 'The Miller Family replied · Sarah & Michael')
    assert.match(email.text, /Elizabeth Miller — Attending/)
    assert.match(email.text, /Attending: 6/)
    assert.match(email.text, /Still waiting: 1/)
    assert.match(email.html, /Running totals/)
    assert.match(email.html, new RegExp(dashboard))
  })

  it('sends the couple a receipt when the page goes live', () => {
    const email = welcomeEmail(sampleWedding(), {
      amountLabel: '$20',
      dashboardUrl: dashboard,
      guestUrl: 'https://piperpweddingdj.services/rsvp/sarah-and-michael',
    })
    assert.equal(email.subject, 'Your RSVP page is live · Sarah & Michael')
    assert.match(email.text, /Paid: \$20/)
    assert.match(email.html, /\$20/)
  })

  it('attaches the caterer CSV to the deadline summary', () => {
    const wedding = sampleWedding()
    const email = deadlineSummaryEmail(
      wedding,
      overviewStats(wedding, Date.now()),
      catererCsv(wedding),
    )
    assert.equal(email.subject, 'RSVP deadline today · Sarah & Michael')
    assert.match(email.text, /Dietary notes:/)
    assert.match(email.text, /Still waiting to hear/)
    const attachment = email.attachments?.[0]
    assert.ok(attachment)
    assert.equal(attachment.filename, 'caterer-report-2027-06-12.csv')
    assert.equal(attachment.contentType, 'text/csv; charset=utf-8')
    assert.match(attachment.content, /Wild salmon/)
  })

  it('styles the sign-in link and the notices to Piper', () => {
    const sign = signInEmail(url)
    assert.equal(sign.subject, 'Your Piper RSVP sign-in link')
    assert.match(sign.html, /Open my RSVP/)
    const signup = piperSignupEmail(sampleWedding())
    assert.equal(signup.subject, 'New RSVP signup · Sarah & Michael')
    const paid = piperPaymentEmail(sampleWedding(), '$20')
    assert.equal(paid.subject, 'RSVP paid · Sarah & Michael')
    assert.match(paid.text, /\$20/)
  })
})

describe('who RSVP emails are from', () => {
  it('guest emails come from the couple, couple emails from the RSVP desk', () => {
    const wedding = sampleWedding()
    wedding.partnerOne = 'Mark'
    wedding.partnerTwo = 'Mya'
    const party = wedding.parties[0]
    assert.ok(party)
    const url = 'https://piperpweddingdj.services/rsvp/x/p/y'
    assert.equal(invitationEmail(wedding, party, url).fromName, 'Mark & Mya · RSVP')
    assert.equal(confirmationEmail(wedding, party, url).fromName, 'Mark & Mya · RSVP')
    assert.equal(reminderEmail(wedding, party, url).fromName, 'Mark & Mya · RSVP')
    const stats = overviewStats(wedding, Date.now())
    assert.equal(
      replyNoticeEmail(wedding, party, stats, url).fromName,
      'RSVP by DJ Piper P',
    )
    assert.equal(
      deadlineSummaryEmail(wedding, stats, 'a,b').fromName,
      'RSVP by DJ Piper P',
    )
    assert.equal(signInEmail(url).fromName, 'RSVP by DJ Piper P')
    assert.equal(
      welcomeEmail(wedding, { amountLabel: '$20', dashboardUrl: url, guestUrl: url }).fromName,
      'RSVP by DJ Piper P',
    )
  })

  it('falls back to "RSVP" without names and leaves owner notices alone', () => {
    assert.equal(guestSender({ partnerOne: ' ', partnerTwo: '' }), 'RSVP')
    assert.equal(
      piperQuestionEmail({
        rsvpId: 'x',
        couple: 'Mark & Mya',
        text: 'Hi',
        askedAt: '2026-10-13T20:00:00Z',
      }).fromName,
      undefined,
    )
  })
})

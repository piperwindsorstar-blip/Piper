import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { sampleWedding } from './demo.ts'
import {
  ceremonyTime,
  confirmationEmail,
  deadlineSummaryEmail,
  formalDate,
  invitationEmail,
  partyNames,
  piperPaymentEmail,
  piperSignupEmail,
  reminderEmail,
  replyNoticeEmail,
  shortDate,
  signInEmail,
  venueParts,
  welcomeEmail,
} from './emails.ts'
import { catererCsv, overviewStats } from './model.ts'

const url = 'https://piperpweddingdj.services/rsvp/sarah-and-michael/p/miller'
const dashboard = 'https://piperpweddingdj.services/rsvp/manage'

describe('invitation style', () => {
  it('writes the date out like a printed invitation', () => {
    assert.equal(
      formalDate('2027-01-13'),
      'Wednesday, the thirteenth of January, 2027',
    )
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
    assert.match(email.html, /#FBF7F0/)
    assert.match(email.html, /border:1px solid/)
    assert.match(email.html, /Georgia/)
    assert.match(email.html, /letter-spacing/)
    assert.match(email.html, /max-width:600px/)
    assert.match(email.html, /brand\/dj-piper-p\.png/)
    assert.match(email.html, new RegExp(url))
    assert.match(email.text, /request the pleasure of your company/)
    assert.match(email.text, /Saturday, the twelfth of June, 2027/)
    assert.match(email.text, /Invitation code SM2027/)
    assert.match(email.text, /For: Elizabeth Miller/)
    // no web font is required
    assert.doesNotMatch(email.html, /fonts\.googleapis/)
  })

  it('follows the theme only as an accent', () => {
    const wedding = sampleWedding()
    const party = wedding.parties[0]
    assert.ok(party)
    const dark = invitationEmail(wedding, party, url)
    wedding.theme = 'light'
    const light = invitationEmail(wedding, party, url)
    assert.match(dark.html, /#B76E79/)
    assert.match(light.html, /#B08D57/)
    // the card stays ivory either way
    assert.match(dark.html, /background:#FBF7F0/)
    assert.match(light.html, /background:#FBF7F0/)
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

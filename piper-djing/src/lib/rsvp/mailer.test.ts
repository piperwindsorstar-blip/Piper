import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { torontoToday } from '../piper/rules.ts'
import { sampleWedding } from './demo.ts'
import { invitationEmail } from './emails.ts'
import { listRsvpEmails, sendRsvpEmail } from './mailer.server.ts'
import { shiftDate } from './model.ts'
import { deliverDueReminders } from './reminders.server.ts'
import { readRsvp, writeRsvp } from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

/** A paid wedding with its deadline seven days from today. */
function dueWedding(slug: string) {
  const wedding = sampleWedding()
  wedding.slug = slug
  wedding.paid = true
  wedding.autoRemind = true
  wedding.deadline = shiftDate(torontoToday(), 7)
  wedding.eventDate = shiftDate(wedding.deadline, 21)
  wedding.remindedOn = ''
  wedding.remindedIds = []
  wedding.remindedManualAt = ''
  wedding.deadlineSummaryOn = ''
  return wedding
}

describe('rsvp email log', { skip: liveBook }, () => {
  it('records a send and lists it back for the desk', async () => {
    const wedding = sampleWedding()
    wedding.slug = 'log-trial'
    await writeRsvp(wedding)
    const party = wedding.parties[0]
    assert.ok(party)
    await sendRsvpEmail({
      slug: wedding.slug,
      kind: 'invitation',
      partyId: party.id,
      to: party.email,
      email: invitationEmail(
        wedding,
        party,
        'https://piperpweddingdj.services/rsvp/log-trial/p/miller',
      ),
    })
    const log = await listRsvpEmails(wedding.slug)
    assert.equal(log.length, 1)
    assert.equal(log[0]?.kind, 'invitation')
    assert.equal(log[0]?.to, party.email)
    assert.equal(log[0]?.partyId, party.id)
    assert.ok((log[0]?.sentAt ?? '').length > 0)
  })

  it('mails the automatic reminder once even if the job runs twice', async () => {
    const wedding = dueWedding('reminder-once')
    await writeRsvp(wedding)
    await deliverDueReminders(wedding)
    await deliverDueReminders(wedding)
    const reminders = (await listRsvpEmails(wedding.slug)).filter(
      (row) => row.kind === 'reminder',
    )
    assert.equal(reminders.length, 1)
    assert.equal(reminders[0]?.to, 'william@example.com')
    const saved = await readRsvp(wedding.slug)
    assert.equal(saved?.remindedOn, torontoToday())
  })

  it('never re-mails a party already marked as reminded', async () => {
    const wedding = dueWedding('reminder-guard')
    wedding.remindedIds = ['thompson']
    await writeRsvp(wedding)
    await deliverDueReminders(wedding)
    const reminders = (await listRsvpEmails(wedding.slug)).filter(
      (row) => row.kind === 'reminder',
    )
    assert.equal(reminders.length, 0)
  })
})

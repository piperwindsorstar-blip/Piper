import { publicUrl } from '../crm/safe-origin.ts'
import { torontoToday } from '../piper/rules.ts'
import { deadlineSummaryEmail, reminderEmail } from './emails.ts'
import {
  catererCsv,
  coupleReplyAddress,
  overviewStats,
  partiesToRemind,
  partiesWaiting,
  rsvpPath,
} from './model.ts'
import type { RsvpParty, RsvpWedding } from './model.ts'
import { sendKey, sendRsvpEmail } from './mailer.server.ts'
import { coupleBookings, writeRsvp } from './store.server.ts'

/** The one invitation link a party replies on. */
export function partyUrl(wedding: RsvpWedding, party: RsvpParty): string {
  return publicUrl(`${rsvpPath(wedding.slug)}/p/${party.token}`)
}

/** Sends the 7-day reminder to one party and records it in the desk log. */
export async function mailPartyReminder(
  wedding: RsvpWedding,
  party: RsvpParty,
): Promise<{ delivered: boolean; detail: string; duplicate?: boolean }> {
  return sendRsvpEmail({
    slug: wedding.slug,
    kind: 'reminder',
    partyId: party.id,
    guard: sendKey(wedding.slug, 'reminder', party.id),
    to: party.email,
    email: reminderEmail(wedding, party, partyUrl(wedding, party)),
  })
}

/** Sends the reminder to each party and reports how many went out. */
export async function mailParties(
  wedding: RsvpWedding,
  parties: RsvpParty[],
): Promise<{ sent: number; detail: string }> {
  let sent = 0
  let detail = ''
  for (const party of parties) {
    const result = await mailPartyReminder(wedding, party)
    if (result.delivered) sent += 1
    else if (!result.duplicate) detail = result.detail
  }
  return { sent, detail }
}

/**
 * The automatic reminder: once per party, exactly seven days before the
 * deadline. Parties are reserved before the send, so a retry or a double load
 * cannot mail anyone twice.
 */
export async function deliverDueReminders(wedding: RsvpWedding): Promise<void> {
  const today = torontoToday()
  await deliverDeadlineSummary(wedding, today)

  const due = partiesToRemind(wedding, today).filter(
    (party) => !wedding.remindedIds.includes(party.id),
  )
  if (due.length === 0) return

  wedding.remindedIds = [
    ...wedding.remindedIds,
    ...due.map((party) => party.id),
  ]
  wedding.remindedOn = today
  await writeRsvp(wedding)

  for (const party of due) {
    const result = await mailPartyReminder(wedding, party)
    if (!result.delivered && !result.duplicate) {
      // Let a later run try again for the parties that did not go out.
      wedding.remindedIds = wedding.remindedIds.filter((id) => id !== party.id)
    }
  }
  await writeRsvp(wedding)
}

/** The final counts on the deadline day, with the caterer CSV attached. */
export async function deliverDeadlineSummary(
  wedding: RsvpWedding,
  today: string,
): Promise<void> {
  if (!wedding.paid) return
  if (!/^\d{4}-\d{2}-\d{2}$/.test(wedding.deadline)) return
  if (today !== wedding.deadline) return
  if (wedding.deadlineSummaryOn === today) return
  const to = coupleReplyAddress(wedding, await coupleBookings())
  if (!to.includes('@')) return
  wedding.deadlineSummaryOn = today
  await writeRsvp(wedding)
  await sendRsvpEmail({
    slug: wedding.slug,
    kind: 'deadline-summary',
    to,
    email: deadlineSummaryEmail(
      wedding,
      overviewStats(wedding, Date.now()),
      catererCsv(wedding),
    ),
  })
}

export { partiesToRemind, partiesWaiting }

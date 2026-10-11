import { emailLetter } from '../crm/mail.server.ts'
import { publicUrl } from '../crm/safe-origin.ts'
import { torontoToday } from '../piper/rules.ts'
import { partiesToRemind, reminderLetter, rsvpPath } from './model.ts'
import type { RsvpWedding } from './model.ts'
import { writeRsvp } from './store.server.ts'

export async function mailParties(
  wedding: RsvpWedding,
  parties: RsvpWedding['parties'],
): Promise<{ sent: number; detail: string }> {
  let sent = 0
  let detail = ''
  for (const party of parties) {
    const result = await emailLetter(
      party.email,
      reminderLetter(wedding, party, publicUrl(rsvpPath(wedding.slug))),
    )
    if (result.delivered) sent += 1
    else detail = result.detail
  }
  return { sent, detail }
}

export async function deliverDueReminders(wedding: RsvpWedding): Promise<void> {
  const today = torontoToday()
  const parties = partiesToRemind(wedding, today)
  if (parties.length === 0) return
  const result = await mailParties(wedding, parties)
  if (result.sent === parties.length) {
    wedding.remindedOn = today
    await writeRsvp(wedding)
  }
}

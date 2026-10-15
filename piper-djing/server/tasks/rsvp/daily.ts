import { defineTask } from 'nitro/task'
import { deliverDueReminders } from '../../../src/lib/rsvp/reminders.server.ts'
import { listRsvps } from '../../../src/lib/rsvp/store.server.ts'

/**
 * Every morning: the 7-day guest reminder and the deadline-day summary for
 * each couple, so they go out even when nobody opens a dashboard that day.
 * Each send is guarded, so this never mails anyone twice.
 */
export default defineTask({
  meta: {
    name: 'rsvp:daily',
    description: 'Send due RSVP reminders and deadline summaries',
  },
  async run() {
    const weddings = await listRsvps()
    let checked = 0
    for (const wedding of weddings) {
      if (wedding.sample) continue
      try {
        await deliverDueReminders(wedding)
        checked += 1
      } catch (error) {
        console.error('[rsvp:daily]', wedding.slug, error)
      }
    }
    return { result: { checked } }
  },
})

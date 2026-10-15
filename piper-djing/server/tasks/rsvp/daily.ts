import { defineTask } from 'nitro/task'
import { deliverDueReminders } from '../../../src/lib/rsvp/reminders.server.ts'
import { listRsvps } from '../../../src/lib/rsvp/store.server.ts'
import { noteJobRun } from '../../../src/lib/job-runs.server.ts'
import { runWeeklyBackup } from '../../../src/lib/backup.server.ts'
import { deliverPlanNudges } from '../../../src/lib/portal/nudges.server.ts'

/**
 * Every morning: the 7-day guest reminder and the deadline-day summary for
 * each couple, plan reminders to couples with unfinished music plans, so they go out even when nobody opens a dashboard that day.
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
    // Plan reminders to couples whose music plan is not finished.
    let plan = ''
    try {
      const nudges = await deliverPlanNudges()
      plan = nudges.off
        ? ' Plan reminders are off.'
        : ` Plan reminders: ${nudges.sent} sent${nudges.failed ? `, ${nudges.failed} failed` : ''}${nudges.noEmail ? `, ${nudges.noEmail} with no email` : ''}.`
    } catch (error) {
      plan = ' Plan reminders failed.'
      console.error('[plan:nudges]', error)
    }
    // Sundays also email the weekly backup. A failure here must not stop the reminders.
    try {
      await runWeeklyBackup()
    } catch (error) {
      console.error('[backup:weekly]', error)
    }
    await noteJobRun(
      'rsvp:daily',
      `Checked ${checked} RSVP site${checked === 1 ? '' : 's'}.${plan}`,
    )
    return { result: { checked } }
  },
})

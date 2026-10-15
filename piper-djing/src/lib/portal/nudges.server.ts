import { query } from '../db.server.ts'
import { lastJobRun } from '../job-runs.server.ts'
import { emailLetter } from '../crm/mail.server.ts'
import { publicUrl } from '../crm/safe-origin.ts'
import { listPlanContacts, readSiteSetting, writeSiteSetting } from '../crm/store.server.ts'
import type { PlanContact } from '../crm/store.server.ts'
import { torontoToday } from '../piper/rules.ts'
import { NUDGE_LABEL, finishDate, nudgeBlock, nudgeDue, nudgeLetter } from './nudges.ts'
import type { NudgeDue, NudgeRow, NudgeStep } from './nudges.ts'

const SETTING = 'plan_reminders'

const TABLE = `CREATE TABLE IF NOT EXISTS plan_nudges (
  booking_id integer NOT NULL,
  step text NOT NULL,
  finish text NOT NULL,
  to_address text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  delivered integer NOT NULL DEFAULT 0,
  detail text NOT NULL DEFAULT '',
  sent_at text NOT NULL,
  PRIMARY KEY (booking_id, step, finish)
)`

async function ensure(): Promise<void> {
  await query(TABLE)
}

/** On unless Piper turns it off. */
export async function planRemindersOn(): Promise<boolean> {
  try {
    return (await readSiteSetting(SETTING)) !== 'off'
  } catch {
    return true
  }
}

export async function setPlanReminders(on: boolean): Promise<boolean> {
  await writeSiteSetting(SETTING, on ? 'on' : 'off')
  return on
}

/**
 * Reserves this step for this couple. A step already delivered is never
 * claimed again; one that failed is retried on the next run.
 */
async function claim(bookingId: number, due: NudgeDue, at: string): Promise<boolean> {
  const rows = await query<{ booking_id: number }>(
    `INSERT INTO plan_nudges (booking_id, step, finish, sent_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (booking_id, step, finish) DO UPDATE SET sent_at = excluded.sent_at
     WHERE plan_nudges.delivered = 0
     RETURNING booking_id`,
    [bookingId, due.step, due.finish, at],
  )
  return rows.length > 0
}

async function record(
  bookingId: number,
  due: NudgeDue,
  to: string,
  subject: string,
  delivered: boolean,
  detail: string,
): Promise<void> {
  await query(
    `UPDATE plan_nudges SET to_address = $1, subject = $2, delivered = $3, detail = $4
     WHERE booking_id = $5 AND step = $6 AND finish = $7`,
    [to, subject, delivered ? 1 : 0, detail.slice(0, 300), bookingId, due.step, due.finish],
  )
}

function letterFor(couple: PlanContact, due: NudgeDue) {
  return nudgeLetter({
    partnerOne: couple.partnerOne,
    partnerTwo: couple.partnerTwo,
    eventDate: couple.eventDate,
    link: publicUrl(`/c/${couple.slug}`),
    due,
    answered: couple.answered,
    total: couple.total,
    percent: couple.percent,
    next: couple.next,
  })
}

/** The daily run: one reminder per couple per step, never twice. */
export async function deliverPlanNudges(
  today = torontoToday(),
): Promise<{ sent: number; failed: number; noEmail: number; off: boolean }> {
  if (!(await planRemindersOn())) return { sent: 0, failed: 0, noEmail: 0, off: true }
  await ensure()
  const couples = await listPlanContacts()
  let sent = 0
  let failed = 0
  let noEmail = 0
  for (const couple of couples) {
    if (nudgeBlock(couple, today) === 'No email on file') {
      noEmail += 1
      continue
    }
    const due = nudgeDue(couple, today)
    if (!due) continue
    try {
      if (!(await claim(couple.bookingId, due, new Date().toISOString()))) continue
      const letter = letterFor(couple, due)
      const result = await emailLetter(couple.email, letter)
      await record(couple.bookingId, due, couple.email, letter.subject, result.delivered, result.detail)
      if (result.delivered) sent += 1
      else failed += 1
    } catch (error) {
      failed += 1
      console.error('[plan:nudge]', couple.slug, error)
    }
  }
  return { sent, failed, noEmail, off: false }
}


/** What the desk shows: each upcoming couple, what is due, what went out. */
export async function planNudgeOverview(today = torontoToday()): Promise<{
  on: boolean
  lastRun: { ranAt: string; note: string } | null
  rows: NudgeRow[]
}> {
  await ensure()
  const [on, couples, sentRows, lastRun] = await Promise.all([
    planRemindersOn(),
    listPlanContacts(),
    query<{ booking_id: number; step: string; delivered: unknown; detail: string; sent_at: string }>(
      'SELECT booking_id, step, delivered, detail, sent_at FROM plan_nudges ORDER BY sent_at DESC',
    ),
    lastJobRun('rsvp:daily').catch(() => null),
  ])
  const latest = new Map<number, (typeof sentRows)[number]>()
  for (const row of sentRows) if (!latest.has(row.booking_id)) latest.set(row.booking_id, row)
  const rows = couples
    .filter((couple) => !couple.sample && couple.status === 'booked' && couple.eventDate > today)
    .map((couple): NudgeRow => {
      const block = nudgeBlock(couple, today)
      const due = nudgeDue(couple, today)
      const last = latest.get(couple.bookingId)
      return {
        slug: couple.slug,
        couple: `${couple.partnerOne} & ${couple.partnerTwo}`,
        eventDate: couple.eventDate,
        finish: finishDate(couple.planning, couple.eventDate),
        percent: couple.percent,
        email: couple.email,
        block,
        due: due ? NUDGE_LABEL[due.step] : '',
        last: last
          ? {
              step: NUDGE_LABEL[last.step as NudgeStep] ?? last.step,
              at: last.sent_at,
              delivered: Number(last.delivered) === 1,
              detail: last.detail,
            }
          : null,
      }
    })
  return { on, lastRun, rows }
}

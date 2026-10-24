import { query } from '../db.server.ts'
import { torontoToday } from '../piper/rules.ts'
import { BALANCE_LABEL, balanceBlock, balanceDue, balanceLetter } from './balance-nudges.ts'
import type { BalanceDue, BalanceRow, BalanceStep } from './balance-nudges.ts'
import { coupleAddresses, deliverToEach } from './mail.server.ts'
import { publicUrl } from './safe-origin.ts'
import { cardStatus } from './stripe.server.ts'
import { listBookings, readSiteSetting, writeSiteSetting } from './store.server.ts'
import type { BookingView } from './store.server.ts'

const SETTING = 'balance_reminders'

const TABLE = `CREATE TABLE IF NOT EXISTS balance_nudges (
  booking_id integer NOT NULL,
  step text NOT NULL,
  event_date text NOT NULL,
  to_address text NOT NULL DEFAULT '',
  subject text NOT NULL DEFAULT '',
  cents integer NOT NULL DEFAULT 0,
  delivered integer NOT NULL DEFAULT 0,
  detail text NOT NULL DEFAULT '',
  sent_at text NOT NULL,
  PRIMARY KEY (booking_id, step, event_date)
)`

async function ensure(): Promise<void> {
  await query(TABLE)
}

export async function balanceRemindersOn(): Promise<boolean> {
  try {
    return (await readSiteSetting(SETTING)) !== 'off'
  } catch {
    return true
  }
}

export async function setBalanceReminders(on: boolean): Promise<boolean> {
  await writeSiteSetting(SETTING, on ? 'on' : 'off')
  return on
}

function asCouple(booking: BookingView) {
  return {
    status: booking.status,
    sample: booking.sample,
    email: booking.email,
    eventDate: booking.eventDate,
    invoice: booking.invoice
      ? { status: booking.invoice.status, balanceCents: booking.invoice.balanceCents }
      : null,
  }
}

/** Reserves this step; a delivered one is never claimed again, a failed one is retried. */
async function claim(booking: BookingView, due: BalanceDue, at: string): Promise<boolean> {
  const rows = await query<{ booking_id: number }>(
    `INSERT INTO balance_nudges (booking_id, step, event_date, sent_at) VALUES ($1, $2, $3, $4)
     ON CONFLICT (booking_id, step, event_date) DO UPDATE SET sent_at = excluded.sent_at
     WHERE balance_nudges.delivered = 0
     RETURNING booking_id`,
    [booking.id, due.step, booking.eventDate, at],
  )
  return rows.length > 0
}

/** The daily run: up to two balance reminders per couple, never twice. */
export async function deliverBalanceNudges(
  today = torontoToday(),
): Promise<{ sent: number; failed: number; noEmail: number; off: boolean }> {
  if (!(await balanceRemindersOn())) return { sent: 0, failed: 0, noEmail: 0, off: true }
  await ensure()
  const [bookings, card] = await Promise.all([
    listBookings(),
    cardStatus().catch(() => ({ enabled: false })),
  ])
  let sent = 0
  let failed = 0
  let noEmail = 0
  for (const booking of bookings) {
    const couple = asCouple(booking)
    if (balanceBlock(couple, today) === 'No email on file') {
      noEmail += 1
      continue
    }
    const due = balanceDue(couple, today)
    if (!due || !booking.invoice) continue
    try {
      if (!(await claim(booking, due, new Date().toISOString()))) continue
      const letter = balanceLetter({
        partnerOne: booking.partnerOne,
        partnerTwo: booking.partnerTwo,
        eventDate: booking.eventDate,
        due,
        invoiceLink: publicUrl(`/p/${booking.invoice.slug}`),
        card: card.enabled,
      })
      const to = coupleAddresses(booking)
      const result = await deliverToEach(to, letter)
      await query(
        `UPDATE balance_nudges SET to_address = $1, subject = $2, cents = $3, delivered = $4, detail = $5
         WHERE booking_id = $6 AND step = $7 AND event_date = $8`,
        [
          to.join(', '),
          letter.subject,
          due.balanceCents,
          result.delivered ? 1 : 0,
          result.detail.slice(0, 300),
          booking.id,
          due.step,
          booking.eventDate,
        ],
      )
      if (result.delivered) sent += 1
      else failed += 1
    } catch (error) {
      failed += 1
      console.error('[balance:nudge]', booking.slug, error)
    }
  }
  return { sent, failed, noEmail, off: false }
}

/** The Money page view: who owes, whether a reminder is due, what went out. */
export async function balanceNudgeOverview(
  bookings: BookingView[],
  today = torontoToday(),
): Promise<{ on: boolean; rows: BalanceRow[] }> {
  await ensure()
  const [on, sentRows] = await Promise.all([
    balanceRemindersOn(),
    query<{ booking_id: number; step: string; delivered: unknown; detail: string; sent_at: string }>(
      'SELECT booking_id, step, delivered, detail, sent_at FROM balance_nudges ORDER BY sent_at DESC',
    ),
  ])
  const latest = new Map<number, (typeof sentRows)[number]>()
  for (const row of sentRows) if (!latest.has(row.booking_id)) latest.set(row.booking_id, row)
  const rows = bookings
    .filter(
      (booking) =>
        !booking.sample &&
        booking.status === 'booked' &&
        booking.eventDate > today &&
        (booking.invoice?.balanceCents ?? 0) > 0,
    )
    .map((booking): BalanceRow => {
      const couple = asCouple(booking)
      const due = balanceDue(couple, today)
      const last = latest.get(booking.id)
      return {
        id: booking.id,
        couple: `${booking.partnerOne} & ${booking.partnerTwo}`,
        eventDate: booking.eventDate,
        balanceCents: booking.invoice?.balanceCents ?? 0,
        email: booking.email.trim(),
        block: balanceBlock(couple, today),
        due: due ? BALANCE_LABEL[due.step] : '',
        last: last
          ? {
              step: BALANCE_LABEL[last.step as BalanceStep] ?? last.step,
              at: last.sent_at,
              delivered: Number(last.delivered) === 1,
              detail: last.detail,
            }
          : null,
      }
    })
  return { on, rows }
}

/**
 * Financials: Martin's income and his Pynx shift hours, for the Desk only.
 *
 * Rules (from his Season Ledger):
 * - Anything hourly is worked through Pynx. Shift pay is already inside the
 *   Pynx deposits in the income log, so it is shown as an estimate beside them
 *   and never added to income again.
 * - Pay periods are two weeks long, counted from Sunday, January 4, 2026.
 * - Overtime is 1.5x after 44 hours in a payroll week (Sunday to Saturday).
 * - A new hourly rate applies from its start date on, never backwards.
 * - Pynx wedding gigs are logged with their job code and no hours; they are
 *   paid per gig inside the Pynx deposits.
 */

export type IncomeCategory = 'pynx' | 'piper' | 'tip' | 'gig' | 'other'
export type ShiftKind = 'hourly' | 'gig'

export const INCOME_CATEGORIES: { id: IncomeCategory; label: string }[] = [
  { id: 'pynx', label: 'Pynx pay' },
  { id: 'piper', label: 'DJ Piper P bookings' },
  { id: 'gig', label: 'Other gigs' },
  { id: 'tip', label: 'Tips' },
  { id: 'other', label: 'Other' },
]

export type IncomeEntry = {
  id: number
  date: string
  name: string
  cents: number
  category: IncomeCategory
}

export type Shift = {
  id: number
  date: string
  /** HH:MM, or '' for a Pynx wedding gig. */
  start: string
  end: string
  kind: ShiftKind
  /** The Pynx job code for a wedding gig. */
  code: string
  notes: string
}

export type Rate = { id: number; from: string; cents: number }

export type Financials = { income: IncomeEntry[]; shifts: Shift[]; rates: Rate[] }

export const PAY_ANCHOR = '2026-01-04'
export const OVERTIME_AFTER_HOURS = 44
export const OVERTIME_TIMES = 1.5

export function isCategory(value: string): value is IncomeCategory {
  return INCOME_CATEGORIES.some((item) => item.id === value)
}

export function categoryLabel(id: string): string {
  return INCOME_CATEGORIES.find((item) => item.id === id)?.label ?? 'Other'
}

const DAY = 86_400_000

function utc(iso: string): number {
  const [y, m, d] = iso.split('-').map(Number)
  return Date.UTC(y ?? 1970, (m ?? 1) - 1, d ?? 1)
}

export function addDays(iso: string, days: number): string {
  return new Date(utc(iso) + days * DAY).toISOString().slice(0, 10)
}

export function daysBetween(from: string, to: string): number {
  return Math.round((utc(to) - utc(from)) / DAY)
}

/** Minutes worked; a shift that ends past midnight runs into the next day. */
export function shiftMinutes(start: string, end: string): number {
  const a = /^(\d{1,2}):(\d{2})$/.exec(start)
  const b = /^(\d{1,2}):(\d{2})$/.exec(end)
  if (!a || !b) return 0
  let minutes = Number(b[1]) * 60 + Number(b[2]) - (Number(a[1]) * 60 + Number(a[2]))
  if (minutes <= 0) minutes += 24 * 60
  return minutes
}

export function shiftHours(shift: Pick<Shift, 'start' | 'end' | 'kind'>): number {
  return shift.kind === 'hourly' ? shiftMinutes(shift.start, shift.end) / 60 : 0
}

/** The rate in force on a date: the latest one that started on or before it. */
export function rateOn(date: string, rates: Pick<Rate, 'from' | 'cents'>[]): number {
  let cents = 0
  let since = ''
  for (const rate of rates) {
    if (rate.from <= date && rate.from >= since) {
      cents = rate.cents
      since = rate.from
    }
  }
  return cents
}

export function periodStart(date: string): string {
  const days = daysBetween(PAY_ANCHOR, date)
  return addDays(PAY_ANCHOR, Math.floor(days / 14) * 14)
}

export function payrollWeekStart(date: string): string {
  const days = daysBetween(PAY_ANCHOR, date)
  return addDays(PAY_ANCHOR, Math.floor(days / 7) * 7)
}

/** Monday of the week, for the Mon–Sun view. */
export function mondayOf(date: string): string {
  const weekday = new Date(utc(date)).getUTCDay()
  return addDays(date, -((weekday + 6) % 7))
}

export type PeriodPay = {
  start: string
  end: string
  hours: number
  overtimeHours: number
  cents: number
  shifts: number
  gigs: string[]
}

/**
 * Estimated Pynx hourly pay per pay period. Overtime is worked out per
 * payroll week, shift by shift in order, at the rate on each shift's date.
 */
export function payPeriods(shifts: Shift[], rates: Pick<Rate, 'from' | 'cents'>[]): PeriodPay[] {
  const sorted = [...shifts].sort((a, b) =>
    a.date === b.date ? a.start.localeCompare(b.start) : a.date.localeCompare(b.date),
  )
  const periods = new Map<string, PeriodPay>()
  const weekHours = new Map<string, number>()
  for (const shift of sorted) {
    const start = periodStart(shift.date)
    const period =
      periods.get(start) ??
      ({ start, end: addDays(start, 13), hours: 0, overtimeHours: 0, cents: 0, shifts: 0, gigs: [] } as PeriodPay)
    periods.set(start, period)
    if (shift.kind === 'gig') {
      period.gigs.push(shift.code || 'Wedding')
      continue
    }
    const hours = shiftHours(shift)
    const week = payrollWeekStart(shift.date)
    const before = weekHours.get(week) ?? 0
    const regular = Math.max(0, Math.min(hours, OVERTIME_AFTER_HOURS - before))
    const overtime = hours - regular
    weekHours.set(week, before + hours)
    const rate = rateOn(shift.date, rates)
    period.hours += hours
    period.overtimeHours += overtime
    period.shifts += 1
    period.cents += Math.round(regular * rate + overtime * rate * OVERTIME_TIMES)
  }
  return [...periods.values()].sort((a, b) => b.start.localeCompare(a.start))
}

export type WeekRow = { monday: string; days: number[]; total: number; gigs: number }

/** Hours per day, Monday to Sunday, newest week first. */
export function weeklyHours(shifts: Shift[]): WeekRow[] {
  const weeks = new Map<string, WeekRow>()
  for (const shift of shifts) {
    const monday = mondayOf(shift.date)
    const row = weeks.get(monday) ?? { monday, days: [0, 0, 0, 0, 0, 0, 0], total: 0, gigs: 0 }
    weeks.set(monday, row)
    if (shift.kind === 'gig') {
      row.gigs += 1
      continue
    }
    const hours = shiftHours(shift)
    const index = daysBetween(monday, shift.date)
    row.days[index] = (row.days[index] ?? 0) + hours
    row.total += hours
  }
  return [...weeks.values()].sort((a, b) => b.monday.localeCompare(a.monday))
}

export function incomeTotals(income: IncomeEntry[]) {
  const byCategory = Object.fromEntries(INCOME_CATEGORIES.map((item) => [item.id, 0])) as Record<IncomeCategory, number>
  const byMonth = Array.from({ length: 12 }, () => 0)
  let total = 0
  for (const entry of income) {
    total += entry.cents
    byCategory[entry.category] = (byCategory[entry.category] ?? 0) + entry.cents
    const month = Number(entry.date.slice(5, 7)) - 1
    if (month >= 0 && month < 12) byMonth[month] = (byMonth[month] ?? 0) + entry.cents
  }
  return { total, byCategory, byMonth }
}

export function weeklyCsv(rows: WeekRow[]): string {
  const head = 'Week of (Mon),Mon,Tue,Wed,Thu,Fri,Sat,Sun,Total hours,Pynx weddings'
  const lines = rows.map((row) =>
    [row.monday, ...row.days.map((h) => h.toFixed(2)), row.total.toFixed(2), row.gigs].join(','),
  )
  return [head, ...lines].join('\n')
}

// --- Checking what the Desk sends -------------------------------------------

export function finDate(value: string, label = 'The date'): string {
  const raw = value.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(raw)) throw new Error(`${label} is required.`)
  const [y, m, d] = raw.split('-').map(Number)
  const back = new Date(Date.UTC(y ?? 0, (m ?? 1) - 1, d ?? 1)).toISOString().slice(0, 10)
  if (back !== raw) throw new Error(`${label} is not a real date.`)
  return raw
}

export function finCents(value: string, label = 'The amount'): number {
  const raw = value.trim().replace(/[$,\s]/g, '')
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) throw new Error(`${label} must be in dollars, like 1650 or 1650.50.`)
  const cents = Math.round(Number(raw) * 100)
  if (cents <= 0) throw new Error(`${label} must be more than $0.`)
  if (cents > 100_000_000) throw new Error(`${label} is too large.`)
  return cents
}

export function finTime(value: string, label: string): string {
  const raw = value.trim()
  const match = /^(\d{1,2}):(\d{2})$/.exec(raw)
  if (!match || Number(match[1]) > 23 || Number(match[2]) > 59) {
    throw new Error(`${label} must be a time like 09:00.`)
  }
  return `${match[1]?.padStart(2, '0') ?? ''}:${match[2] ?? ''}`
}

export function finText(value: string, max: number, label: string, required = false): string {
  const text = value.trim().replace(/\s+/g, ' ').slice(0, max)
  if (required && !text) throw new Error(`${label} is required.`)
  return text
}

export function dollars(cents: number): string {
  const whole = cents % 100 === 0
  return `$${(cents / 100).toLocaleString('en-CA', {
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

export function hoursText(hours: number): string {
  return Number.isInteger(hours) ? String(hours) : hours.toFixed(2).replace(/0$/, '')
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

export function shortDay(iso: string): string {
  return `${MONTHS[Number(iso.slice(5, 7)) - 1] ?? ''} ${Number(iso.slice(8, 10))}`
}

export const MONTH_NAMES = MONTHS

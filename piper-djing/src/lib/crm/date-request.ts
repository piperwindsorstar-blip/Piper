export const EVENT_TYPES = [
  'Wedding',
  'Stag and doe',
  'Ceremony only',
  'Engagement party',
  'Anniversary',
  'Private party',
] as const

export type EventType = (typeof EVENT_TYPES)[number]

export type DateRequestInput = {
  date: string
  eventType: string
  company: string
}

export type DateRequest =
  | { ok: true; silent: true }
  | { ok: true; silent: false; date: string; eventType: EventType }
  | { ok: false; error: string }

export function todayInToronto(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Toronto',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

export function parseDateRequest(
  input: DateRequestInput,
  today: string,
): DateRequest {
  if (input.company.trim()) return { ok: true, silent: true }
  const date = input.date.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Choose a date.' }
  }
  if (date < today) {
    return { ok: false, error: 'Choose a date from today on.' }
  }
  const eventType = EVENT_TYPES.find((item) => item === input.eventType)
  if (!eventType) return { ok: false, error: 'Choose an event type.' }
  return { ok: true, silent: false, date, eventType }
}

export function dateCheckAnswer(open: boolean): string {
  return open
    ? 'Yes, your date is available.'
    : 'No, your date is not available.'
}

export type CalendarCell = {
  date: string
  inMonth: boolean
}

/** Sunday-first weeks for one month. `monthIndex` is 0 for January. */
export function calendarWeeks(
  year: number,
  monthIndex: number,
): CalendarCell[][] {
  const firstWeekday = new Date(Date.UTC(year, monthIndex, 1)).getUTCDay()
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate()
  const cells: CalendarCell[] = []
  for (let index = 0; index < firstWeekday; index += 1) {
    const date = new Date(Date.UTC(year, monthIndex, index - firstWeekday + 1))
    cells.push({ date: date.toISOString().slice(0, 10), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, monthIndex, day))
    cells.push({ date: date.toISOString().slice(0, 10), inMonth: true })
  }
  let next = 1
  while (cells.length % 7 !== 0) {
    const date = new Date(Date.UTC(year, monthIndex + 1, next))
    cells.push({ date: date.toISOString().slice(0, 10), inMonth: false })
    next += 1
  }
  const weeks: CalendarCell[][] = []
  for (let index = 0; index < cells.length; index += 7) {
    weeks.push(cells.slice(index, index + 7))
  }
  return weeks
}

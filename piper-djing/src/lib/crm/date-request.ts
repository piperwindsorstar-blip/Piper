export const WEDDING_EVENT_TYPES = [
  'Wedding',
  'Stag and doe',
  'Ceremony only',
  'Anniversary',
] as const

export const HOME_EVENT_TYPES = [
  ...WEDDING_EVENT_TYPES,
  'Birthday party',
  'Christmas party',
] as const

export const CUSTOM_EVENT = 'Something else'

export type EventType = (typeof WEDDING_EVENT_TYPES)[number]

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

export function parseCheckedEvent(
  input: DateRequestInput & { custom: string; allowed: readonly string[] },
  today: string,
):
  | { ok: true; silent: true }
  | { ok: true; silent: false; date: string; event: string }
  | { ok: false; error: string } {
  if (input.company.trim()) return { ok: true, silent: true }
  const date = input.date.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return { ok: false, error: 'Choose a date.' }
  }
  if (date < today) {
    return { ok: false, error: 'Choose a date from today on.' }
  }
  if (input.eventType === CUSTOM_EVENT) {
    const custom = input.custom.trim()
    if (!custom) return { ok: false, error: 'Tell Piper what the event is.' }
    if (custom.length > 80) {
      return { ok: false, error: 'That event name is too long.' }
    }
    return { ok: true, silent: false, date, event: custom }
  }
  if (!input.allowed.includes(input.eventType)) {
    return { ok: false, error: 'Choose an event type.' }
  }
  return { ok: true, silent: false, date, event: input.eventType }
}

export function parseDateRequest(
  input: DateRequestInput,
  today: string,
): DateRequest {
  const parsed = parseCheckedEvent(
    { ...input, custom: '', allowed: WEDDING_EVENT_TYPES },
    today,
  )
  if (!parsed.ok || parsed.silent) return parsed
  return {
    ok: true,
    silent: false,
    date: parsed.date,
    eventType: parsed.event as EventType,
  }
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

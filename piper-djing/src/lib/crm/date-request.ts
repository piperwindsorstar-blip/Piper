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

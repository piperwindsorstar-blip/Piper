/**
 * Show numbers: the event year's last two digits and a running count in that
 * year, such as 26-01. A number stays with its booking once given; test
 * samples get none.
 */

export function showPrefix(eventDate: string): string {
  return /^\d{4}-/.test(eventDate) ? eventDate.slice(2, 4) : ''
}

function countOf(number: string, prefix: string): number {
  const match = number.match(/^(\d{2})-(\d+)$/)
  return match && match[1] === prefix ? Number(match[2]) : 0
}

/** The next free number for an event date, after every number already given. */
export function nextShowNumber(given: string[], eventDate: string): string {
  const prefix = showPrefix(eventDate)
  if (!prefix) return ''
  const top = given.reduce((max, number) => Math.max(max, countOf(number, prefix)), 0)
  return `${prefix}-${String(top + 1).padStart(2, '0')}`
}

/** True when a booking's number belongs to its event year. */
export function numberFits(number: string, eventDate: string): boolean {
  const prefix = showPrefix(eventDate)
  return Boolean(prefix) && countOf(number, prefix) > 0
}

export type NumberRow = { id: number; eventDate: string; sample: boolean; showNumber: string }

/**
 * Numbers for the bookings that have none (or one from another year), in
 * event date order within each year, after the numbers already given.
 */
export function missingNumbers(rows: NumberRow[]): { id: number; showNumber: string }[] {
  const given = rows.filter((row) => !row.sample && numberFits(row.showNumber, row.eventDate)).map((row) => row.showNumber)
  const out: { id: number; showNumber: string }[] = []
  const waiting = rows
    .filter((row) => !row.sample && !numberFits(row.showNumber, row.eventDate) && showPrefix(row.eventDate))
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate) || a.id - b.id)
  for (const row of waiting) {
    const showNumber = nextShowNumber(given, row.eventDate)
    given.push(showNumber)
    out.push({ id: row.id, showNumber })
  }
  return out
}

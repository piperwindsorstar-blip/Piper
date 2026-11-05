/**
 * Which tables a backup copies. Everything that is the business's own record
 * goes in; sign-in sessions, bot keys, send logs, caches and photo bytes stay
 * out (secrets don't belong in an inbox, and the rest is bulky or rebuilt).
 */
const LEFT_OUT = new Set([
  'sessions',
  'login_misses',
  'bots',
  'bot_idempotency',
  'emails',
  'rsvp_emails',
  'rsvp_send_guard',
  'travel_cache',
  'rsvp_photos',
  'rsvp_photo_parts',
  'rsvp_photo_crops',
  'rsvp_photo_crop_parts',
  'job_runs',
])

export function backupTables(all: string[]): string[] {
  return all
    .filter((name) => /^[a-z_][a-z0-9_]*$/.test(name))
    .filter((name) => !name.startsWith('sqlite_') && !name.startsWith('_cf'))
    .filter((name) => !LEFT_OUT.has(name))
    .sort()
}

export function backupFileName(isoNow: string): string {
  return `piper-backup-${isoNow.slice(0, 10)}.json`
}

/** True on the days the weekly backup email goes out (Sunday, Toronto). */
export function backupDay(torontoDate: string): boolean {
  const [year, month, day] = torontoDate.split('-').map(Number)
  if (!year || !month || !day) return false
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0
}

/** The backup as one JSON file: when it was made, and every table's rows. */
export function backupJson(
  tables: Record<string, unknown[]>,
  isoNow: string,
): string {
  return JSON.stringify(
    { app: 'piper-djing', createdAt: isoNow, tables },
    (_key, value: unknown) =>
      typeof value === 'bigint' ? value.toString() : value,
    2,
  )
}

/** A short line about what a backup holds, e.g. "12 tables, 340 rows". */
export function backupSummary(tables: Record<string, unknown[]>): string {
  const names = Object.keys(tables)
  const rows = names.reduce((sum, name) => sum + tables[name].length, 0)
  return `${names.length} ${names.length === 1 ? 'table' : 'tables'}, ${rows} ${rows === 1 ? 'row' : 'rows'}`
}

/** Gmail stops at 25 MB, so a bigger file is offered on the desk instead. */
export const BACKUP_EMAIL_LIMIT = 18 * 1024 * 1024

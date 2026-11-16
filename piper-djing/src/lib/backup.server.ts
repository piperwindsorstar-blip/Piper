import {
  backupDay,
  backupFileName,
  backupJson,
  backupSummary,
  backupTables,
  BACKUP_EMAIL_LIMIT,
} from './backup.ts'
import { query, usesEdgeBook } from './db.server.ts'
import { lastJobRun, noteJobRun } from './job-runs.server.ts'
import { emailOwner } from './crm/mail.server.ts'
import { torontoToday } from './piper/rules.ts'

async function allTableNames(): Promise<string[]> {
  if (usesEdgeBook()) {
    const rows = await query<{ name: string }>(
      "SELECT name FROM sqlite_master WHERE type = 'table'",
    )
    return rows.map((row) => row.name)
  }
  const rows = await query<{ table_name: string }>(
    "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public' AND table_type = 'BASE TABLE'",
  )
  return rows.map((row) => row.table_name)
}

/** Every business table as one JSON file. Names are checked before they reach SQL. */
export async function readBackup(now = new Date()): Promise<{
  filename: string
  json: string
  summary: string
}> {
  const names = backupTables(await allTableNames())
  const tables: Record<string, unknown[]> = {}
  for (const name of names) {
    tables[name] = await query(`SELECT * FROM "${name}"`)
  }
  const iso = now.toISOString()
  return {
    filename: backupFileName(iso),
    json: backupJson(tables, iso),
    summary: backupSummary(tables),
  }
}

/**
 * Sundays (Toronto): email the backup to the desk owner. A day is only done
 * once, so a retry or a second run the same morning sends nothing more.
 */
export async function runWeeklyBackup(): Promise<string | null> {
  const today = torontoToday()
  if (!backupDay(today)) return null
  const last = await lastJobRun('backup:weekly')
  if (
    last &&
    last.ranAt.slice(0, 10) === today &&
    last.note.startsWith('Emailed')
  ) {
    return null
  }
  const backup = await readBackup()
  const size = new TextEncoder().encode(backup.json).length
  if (size > BACKUP_EMAIL_LIMIT) {
    const note = `Too big to email (${Math.round(size / 1048576)} MB). Download it from Settings.`
    await noteJobRun('backup:weekly', note)
    return note
  }
  const result = await emailOwner({
    subject: `Piper backup ${today}`,
    text: `Your weekly backup is attached (${backup.summary}).\n\nIt holds your bookings, invoices, payments, leads, RSVP sites and settings. Sign-in sessions, bot keys, email logs and photos are left out. Keep this email somewhere safe.`,
    attachments: [
      {
        filename: backup.filename,
        content: backup.json,
        contentType: 'application/json',
      },
    ],
  })
  const note = result.delivered
    ? `Emailed ${backup.filename} (${backup.summary}).`
    : `Not emailed: ${result.detail}`
  await noteJobRun('backup:weekly', note)
  return note
}

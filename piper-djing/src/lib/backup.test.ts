import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  backupDay,
  backupFileName,
  backupJson,
  backupSummary,
  backupTables,
} from './backup.ts'

describe('backups', () => {
  it('keeps business records and leaves out secrets, logs and photos', () => {
    const picked = backupTables([
      'bookings',
      'invoices',
      'payments',
      'leads',
      'rsvp_weddings',
      'rsvp_timeline',
      'sessions',
      'login_misses',
      'bots',
      'emails',
      'rsvp_photo_parts',
      'sqlite_sequence',
      '_cf_KV',
      'Bad-Name',
    ])
    assert.deepEqual(picked, [
      'bookings',
      'invoices',
      'leads',
      'payments',
      'rsvp_timeline',
      'rsvp_weddings',
    ])
  })

  it('names the file by day and sends on Sundays', () => {
    assert.equal(
      backupFileName('2026-10-18T12:13:00.000Z'),
      'piper-backup-2026-10-18.json',
    )
    assert.equal(backupDay('2026-10-18'), true)
    assert.equal(backupDay('2026-10-19'), false)
    assert.equal(backupDay('nope'), false)
  })

  it('writes one JSON file, with big numbers as text, and counts it', () => {
    const tables = {
      bookings: [
        { id: 1, total: 10n },
        { id: 2, total: 5n },
      ],
    }
    const parsed = JSON.parse(backupJson(tables, '2026-10-18T12:00:00.000Z'))
    assert.equal(parsed.createdAt, '2026-10-18T12:00:00.000Z')
    assert.equal(parsed.tables.bookings[0].total, '10')
    assert.equal(backupSummary(tables), '1 table, 2 rows')
    assert.equal(backupSummary({}), '0 tables, 0 rows')
  })
})

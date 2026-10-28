import { query, queryBatch } from '../db.server.ts'
import { STARTING_GEAR, gearPurchased, gearText, gearValueCents } from './gear.ts'
import type { GearDraft, GearItem } from './gear.ts'

/**
 * The gear table. Desk only: nothing outside the Desk's own server calls reads
 * it. The starting list is added once; after that only the Desk changes it,
 * so a deleted item stays deleted.
 */

const TABLES = [
  `CREATE TABLE IF NOT EXISTS gear (
    id integer PRIMARY KEY,
    item text NOT NULL,
    serial text NOT NULL DEFAULT '',
    purchased text NOT NULL DEFAULT '',
    value_cents integer,
    notes text NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS gear_setup (key text PRIMARY KEY)`,
]

let ready: Promise<void> | null = null

function ensureGear(): Promise<void> {
  if (!ready) {
    ready = setUp().catch((error: unknown) => {
      ready = null
      throw error
    })
  }
  return ready
}

async function setUp(): Promise<void> {
  const results = await queryBatch([
    ...TABLES.map((sql) => ({ sql })),
    { sql: `SELECT key FROM gear_setup WHERE key = 'seeded'` },
  ])
  if ((results[TABLES.length] ?? []).length > 0) return
  await queryBatch([
    ...STARTING_GEAR.map((row, index) => ({
      sql: `INSERT INTO gear (id, item, serial, purchased, value_cents, notes)
            VALUES ($1, $2, $3, $4, $5, $6) ON CONFLICT (id) DO NOTHING`,
      params: [index + 1, row.item, row.serial, row.purchased, row.valueCents, row.notes],
    })),
    { sql: `INSERT INTO gear_setup (key) VALUES ('seeded') ON CONFLICT (key) DO NOTHING` },
  ])
}

type GearRow = {
  id: unknown
  item: string
  serial: string
  purchased: string
  value_cents: unknown
  notes: string
}

function toItem(row: GearRow): GearItem {
  const cents = row.value_cents === null || row.value_cents === undefined ? null : Number(row.value_cents)
  return {
    id: Number(row.id),
    item: row.item,
    serial: row.serial,
    purchased: row.purchased,
    valueCents: cents === null || !Number.isFinite(cents) ? null : cents,
    notes: row.notes,
  }
}

function clean(draft: GearDraft) {
  return {
    item: gearText(draft.item, 200, 'The item', true),
    serial: gearText(draft.serial, 80, 'The serial number'),
    purchased: gearPurchased(draft.purchased),
    valueCents: gearValueCents(draft.value),
    notes: gearText(draft.notes, 500, 'The notes'),
  }
}

export async function listGear(): Promise<GearItem[]> {
  await ensureGear()
  const rows = await query<GearRow>(
    'SELECT id, item, serial, purchased, value_cents, notes FROM gear ORDER BY id',
  )
  return rows.map(toItem)
}

export async function addGear(draft: GearDraft): Promise<void> {
  await ensureGear()
  const next = clean(draft)
  const ids = await query<{ next: unknown }>('SELECT COALESCE(MAX(id), 0) + 1 AS next FROM gear')
  await query(
    `INSERT INTO gear (id, item, serial, purchased, value_cents, notes)
     VALUES ($1, $2, $3, $4, $5, $6)`,
    [Number(ids[0]?.next) || 1, next.item, next.serial, next.purchased, next.valueCents, next.notes],
  )
}

async function exists(id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id < 1) return false
  return (await query('SELECT id FROM gear WHERE id = $1', [id])).length > 0
}

export async function updateGear(id: number, draft: GearDraft): Promise<void> {
  await ensureGear()
  if (!(await exists(id))) throw new Error('That item is no longer on the list.')
  const next = clean(draft)
  await query(
    `UPDATE gear SET item = $1, serial = $2, purchased = $3, value_cents = $4, notes = $5
     WHERE id = $6`,
    [next.item, next.serial, next.purchased, next.valueCents, next.notes, id],
  )
}

export async function removeGear(id: number): Promise<void> {
  await ensureGear()
  if (!Number.isInteger(id) || id < 1) throw new Error('That item is no longer on the list.')
  await query('DELETE FROM gear WHERE id = $1', [id])
}

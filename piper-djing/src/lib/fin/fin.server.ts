import { query, queryBatch } from '../db.server.ts'
import { finCents, finDate, finText, finTime, isCategory } from './fin.ts'
import type { Financials, IncomeCategory, IncomeEntry, Rate, Shift } from './fin.ts'
import { SEED_INCOME, SEED_RATES, SEED_SHIFTS } from './seed.ts'

/**
 * Financials in the Book. Desk only: nothing outside the Desk's own server
 * calls reads these tables. The sheet's data is added once; after that only
 * the Desk changes it, so a deleted row stays deleted.
 */

const TABLES = [
  `CREATE TABLE IF NOT EXISTS fin_income (
    id integer PRIMARY KEY,
    day text NOT NULL,
    name text NOT NULL,
    cents integer NOT NULL,
    category text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS fin_shifts (
    id integer PRIMARY KEY,
    day text NOT NULL,
    start_time text NOT NULL DEFAULT '',
    end_time text NOT NULL DEFAULT '',
    kind text NOT NULL,
    code text NOT NULL DEFAULT '',
    notes text NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS fin_rates (
    id integer PRIMARY KEY,
    from_day text NOT NULL,
    cents integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS fin_setup (key text PRIMARY KEY)`,
]

let ready: Promise<void> | null = null

function ensureFin(): Promise<void> {
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
    { sql: `SELECT key FROM fin_setup WHERE key = 'seeded'` },
  ])
  if ((results[TABLES.length] ?? []).length > 0) return
  await queryBatch([
    ...SEED_INCOME.map((row, index) => ({
      sql: `INSERT INTO fin_income (id, day, name, cents, category) VALUES ($1, $2, $3, $4, $5)
            ON CONFLICT (id) DO NOTHING`,
      params: [index + 1, row.date, row.name, row.cents, row.category],
    })),
    ...SEED_SHIFTS.map((row, index) => ({
      sql: `INSERT INTO fin_shifts (id, day, start_time, end_time, kind, code, notes)
            VALUES ($1, $2, $3, $4, $5, $6, '') ON CONFLICT (id) DO NOTHING`,
      params: [index + 1, row.date, row.start, row.end, row.kind, row.code],
    })),
    ...SEED_RATES.map((row, index) => ({
      sql: `INSERT INTO fin_rates (id, from_day, cents) VALUES ($1, $2, $3) ON CONFLICT (id) DO NOTHING`,
      params: [index + 1, row.from, row.cents],
    })),
    { sql: `INSERT INTO fin_setup (key) VALUES ('seeded') ON CONFLICT (key) DO NOTHING` },
  ])
}

const num = (value: unknown) => Number(value) || 0

export async function readFinancials(): Promise<Financials> {
  await ensureFin()
  const [income = [], shifts = [], rates = []] = (await queryBatch([
    { sql: 'SELECT id, day, name, cents, category FROM fin_income ORDER BY day DESC, id DESC' },
    { sql: 'SELECT id, day, start_time, end_time, kind, code, notes FROM fin_shifts ORDER BY day DESC, start_time DESC, id DESC' },
    { sql: 'SELECT id, from_day, cents FROM fin_rates ORDER BY from_day' },
  ])) as [Record<string, unknown>[], Record<string, unknown>[], Record<string, unknown>[]]
  return {
    income: income.map(
      (row): IncomeEntry => ({
        id: num(row.id),
        date: String(row.day),
        name: String(row.name),
        cents: num(row.cents),
        category: isCategory(String(row.category)) ? (String(row.category) as IncomeCategory) : 'other',
      }),
    ),
    shifts: shifts.map(
      (row): Shift => ({
        id: num(row.id),
        date: String(row.day),
        start: String(row.start_time ?? ''),
        end: String(row.end_time ?? ''),
        kind: row.kind === 'gig' ? 'gig' : 'hourly',
        code: String(row.code ?? ''),
        notes: String(row.notes ?? ''),
      }),
    ),
    rates: rates.map((row): Rate => ({ id: num(row.id), from: String(row.from_day), cents: num(row.cents) })),
  }
}

async function nextId(table: 'fin_income' | 'fin_shifts' | 'fin_rates'): Promise<number> {
  const rows = await query<{ next: unknown }>(`SELECT COALESCE(MAX(id), 0) + 1 AS next FROM ${table}`)
  return num(rows[0]?.next) || 1
}

async function exists(table: 'fin_income' | 'fin_shifts' | 'fin_rates', id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id < 1) return false
  return (await query(`SELECT id FROM ${table} WHERE id = $1`, [id])).length > 0
}

export type IncomeDraft = { date: string; name: string; amount: string; category: string }
export type ShiftDraft = { date: string; kind: string; start: string; end: string; code: string; notes: string }
export type RateDraft = { from: string; amount: string }

function cleanIncome(draft: IncomeDraft) {
  if (!isCategory(draft.category)) throw new Error('Choose a category.')
  return {
    date: finDate(draft.date),
    name: finText(draft.name, 120, 'What it was for', true),
    cents: finCents(draft.amount),
    category: draft.category,
  }
}

function cleanShift(draft: ShiftDraft) {
  const date = finDate(draft.date)
  const notes = finText(draft.notes, 300, 'Notes')
  if (draft.kind === 'gig') {
    return { date, kind: 'gig', start: '', end: '', code: finText(draft.code, 40, 'The job code'), notes }
  }
  const start = finTime(draft.start, 'In')
  const end = finTime(draft.end, 'Out')
  if (start === end) throw new Error('In and Out are the same time.')
  return { date, kind: 'hourly', start, end, code: '', notes }
}

function cleanRate(draft: RateDraft) {
  return { from: finDate(draft.from, 'The start date'), cents: finCents(draft.amount, 'The hourly rate') }
}

export async function addIncome(draft: IncomeDraft): Promise<void> {
  await ensureFin()
  const row = cleanIncome(draft)
  await query('INSERT INTO fin_income (id, day, name, cents, category) VALUES ($1, $2, $3, $4, $5)', [
    await nextId('fin_income'), row.date, row.name, row.cents, row.category,
  ])
}

export async function updateIncome(id: number, draft: IncomeDraft): Promise<void> {
  await ensureFin()
  if (!(await exists('fin_income', id))) throw new Error('That entry is no longer there.')
  const row = cleanIncome(draft)
  await query('UPDATE fin_income SET day = $1, name = $2, cents = $3, category = $4 WHERE id = $5', [
    row.date, row.name, row.cents, row.category, id,
  ])
}

export async function addShift(draft: ShiftDraft): Promise<void> {
  await ensureFin()
  const row = cleanShift(draft)
  await query(
    `INSERT INTO fin_shifts (id, day, start_time, end_time, kind, code, notes) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [await nextId('fin_shifts'), row.date, row.start, row.end, row.kind, row.code, row.notes],
  )
}

export async function updateShift(id: number, draft: ShiftDraft): Promise<void> {
  await ensureFin()
  if (!(await exists('fin_shifts', id))) throw new Error('That shift is no longer there.')
  const row = cleanShift(draft)
  await query(
    `UPDATE fin_shifts SET day = $1, start_time = $2, end_time = $3, kind = $4, code = $5, notes = $6 WHERE id = $7`,
    [row.date, row.start, row.end, row.kind, row.code, row.notes, id],
  )
}

export async function addRate(draft: RateDraft): Promise<void> {
  await ensureFin()
  const row = cleanRate(draft)
  const same = await query('SELECT id FROM fin_rates WHERE from_day = $1', [row.from])
  if (same.length > 0) throw new Error('A rate already starts on that date. Edit it instead.')
  await query('INSERT INTO fin_rates (id, from_day, cents) VALUES ($1, $2, $3)', [
    await nextId('fin_rates'), row.from, row.cents,
  ])
}

export async function updateRate(id: number, draft: RateDraft): Promise<void> {
  await ensureFin()
  if (!(await exists('fin_rates', id))) throw new Error('That rate is no longer there.')
  const row = cleanRate(draft)
  await query('UPDATE fin_rates SET from_day = $1, cents = $2 WHERE id = $3', [row.from, row.cents, id])
}

export async function removeRow(table: 'income' | 'shift' | 'rate', id: number): Promise<void> {
  await ensureFin()
  const name = table === 'income' ? 'fin_income' : table === 'shift' ? 'fin_shifts' : 'fin_rates'
  if (!Number.isInteger(id) || id < 1) throw new Error('That row is no longer there.')
  await query(`DELETE FROM ${name} WHERE id = $1`, [id])
}

import { query } from './db.server.ts'

/**
 * When each background job last ran, so the desk can show the daily jobs are
 * working without anyone reading server logs.
 */
async function ensureTable(): Promise<void> {
  await query(
    'CREATE TABLE IF NOT EXISTS job_runs (name text PRIMARY KEY, ran_at text NOT NULL, note text NOT NULL DEFAULT \'\')',
  )
}

export async function noteJobRun(name: string, note: string): Promise<void> {
  await ensureTable()
  await query(
    `INSERT INTO job_runs (name, ran_at, note) VALUES ($1, $2, $3)
     ON CONFLICT (name) DO UPDATE SET ran_at = excluded.ran_at, note = excluded.note`,
    [name, new Date().toISOString(), note.slice(0, 200)],
  )
}

export async function lastJobRun(
  name: string,
): Promise<{ ranAt: string; note: string } | null> {
  await ensureTable()
  const rows = await query<{ ran_at: string; note: string }>(
    'SELECT ran_at, note FROM job_runs WHERE name = $1',
    [name],
  )
  const row = rows.at(0)
  return row ? { ranAt: row.ran_at, note: row.note } : null
}

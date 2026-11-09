import { createServerFn } from '@tanstack/react-start'
import { requireDesk } from '../auth/session.server.ts'
import {
  addIncome,
  addRate,
  addShift,
  readFinancials,
  removeRow,
  updateIncome,
  updateRate,
  updateShift,
} from './fin.server.ts'
import type { IncomeDraft, RateDraft, ShiftDraft } from './fin.server.ts'

/** Desk only: every call checks the Desk sign-in first. */

type Result = { ok: true } | { ok: false; error: string }

async function run(step: () => Promise<void>): Promise<Result> {
  try {
    await step()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'That did not save.' }
  }
}

const s = (value: unknown) => String(value ?? '')

export const getFinancials = createServerFn({ method: 'GET' }).handler(async () => {
  await requireDesk()
  return readFinancials()
})

export const saveIncome = createServerFn({ method: 'POST' })
  .validator((data: IncomeDraft & { id?: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    const draft = { date: s(data.date), name: s(data.name), amount: s(data.amount), category: s(data.category) }
    return run(() => (data.id ? updateIncome(Number(data.id), draft) : addIncome(draft)))
  })

export const saveShift = createServerFn({ method: 'POST' })
  .validator((data: ShiftDraft & { id?: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    const draft = {
      date: s(data.date),
      kind: s(data.kind),
      start: s(data.start),
      end: s(data.end),
      code: s(data.code),
      notes: s(data.notes),
    }
    return run(() => (data.id ? updateShift(Number(data.id), draft) : addShift(draft)))
  })

export const saveRate = createServerFn({ method: 'POST' })
  .validator((data: RateDraft & { id?: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    const draft = { from: s(data.from), amount: s(data.amount) }
    return run(() => (data.id ? updateRate(Number(data.id), draft) : addRate(draft)))
  })

export const deleteFinRow = createServerFn({ method: 'POST' })
  .validator((data: { table: 'income' | 'shift' | 'rate'; id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    const table = data.table === 'shift' || data.table === 'rate' ? data.table : 'income'
    return run(() => removeRow(table, Number(data.id)))
  })

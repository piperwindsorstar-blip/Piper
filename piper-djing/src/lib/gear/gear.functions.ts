import { createServerFn } from '@tanstack/react-start'
import { requireDesk } from '../auth/session.server.ts'
import { addGear, listGear, removeGear, updateGear } from './gear.server.ts'
import type { GearDraft } from './gear.ts'

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

function draft(data: Partial<GearDraft>): GearDraft {
  return {
    item: String(data.item ?? ''),
    serial: String(data.serial ?? ''),
    purchased: String(data.purchased ?? ''),
    value: String(data.value ?? ''),
    notes: String(data.notes ?? ''),
  }
}

export const getGear = createServerFn({ method: 'GET' }).handler(async () => {
  await requireDesk()
  return listGear()
})

export const saveNewGear = createServerFn({ method: 'POST' })
  .validator((data: GearDraft) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => addGear(draft(data)))
  })

export const saveGear = createServerFn({ method: 'POST' })
  .validator((data: GearDraft & { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => updateGear(Number(data.id), draft(data)))
  })

export const deleteGear = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => removeGear(Number(data.id)))
  })

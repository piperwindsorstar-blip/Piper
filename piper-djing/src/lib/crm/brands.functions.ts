import { createServerFn } from '@tanstack/react-start'
import { requireDesk } from '../auth/session.server.ts'
import {
  addBrand,
  listDeskBrands,
  moveBrand,
  removeBrand,
  setBrandShown,
  updateBrand,
} from './brands.server.ts'

/** Desk only: every call checks the desk sign-in first. */

type Result = { ok: true } | { ok: false; error: string }

async function run(step: () => Promise<void>): Promise<Result> {
  try {
    await step()
    return { ok: true }
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : 'That did not save.' }
  }
}

export const getDeskBrands = createServerFn({ method: 'GET' }).handler(async () => {
  await requireDesk()
  return listDeskBrands()
})

export const saveNewBrand = createServerFn({ method: 'POST' })
  .validator((data: { name: string; href: string; logo: string; shown: boolean }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() =>
      addBrand({
        name: String(data.name ?? ''),
        href: String(data.href ?? ''),
        logo: String(data.logo ?? ''),
        shown: data.shown !== false,
      }),
    )
  })

export const saveBrand = createServerFn({ method: 'POST' })
  .validator((data: { id: number; name: string; href: string; logo: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() =>
      updateBrand({
        id: Number(data.id),
        name: String(data.name ?? ''),
        href: String(data.href ?? ''),
        logo: String(data.logo ?? ''),
      }),
    )
  })

export const showBrand = createServerFn({ method: 'POST' })
  .validator((data: { id: number; shown: boolean }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => setBrandShown(Number(data.id), data.shown === true))
  })

export const deleteBrand = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => removeBrand(Number(data.id)))
  })

export const shiftBrand = createServerFn({ method: 'POST' })
  .validator((data: { id: number; direction: 'up' | 'down' }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => moveBrand(Number(data.id), data.direction === 'up' ? 'up' : 'down'))
  })

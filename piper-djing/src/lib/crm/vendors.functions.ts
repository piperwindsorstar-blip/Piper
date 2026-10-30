import { createServerFn } from '@tanstack/react-start'
import { requireDesk } from '../auth/session.server.ts'
import {
  addVendor,
  addVendorCategory,
  listDeskVendors,
  moveVendor,
  moveVendorCategory,
  removeVendor,
  removeVendorCategory,
  renameVendorCategory,
  setVendorShown,
  updateVendor,
} from './vendors.server.ts'

/** Desk only: every call checks the desk sign-in first. */

type Result = { ok: true } | { ok: false; error: string }

async function run(step: () => Promise<void>): Promise<Result> {
  try {
    await step()
    return { ok: true }
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : 'That did not save.',
    }
  }
}

function direction(value: unknown): 'up' | 'down' {
  return value === 'up' ? 'up' : 'down'
}

export const getDeskVendors = createServerFn({ method: 'GET' }).handler(async () => {
  await requireDesk()
  return listDeskVendors()
})

export const saveNewVendor = createServerFn({ method: 'POST' })
  .validator(
    (data: { name: string; categoryId: number; href: string; logo: string; shown: boolean }) =>
      data,
  )
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() =>
      addVendor({
        name: String(data.name ?? ''),
        categoryId: Number(data.categoryId),
        href: String(data.href ?? ''),
        logo: String(data.logo ?? ''),
        shown: data.shown !== false,
      }),
    )
  })

export const saveVendor = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      id: number
      name: string
      categoryId: number
      href: string
      logo: string
      removeLogo: boolean
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() =>
      updateVendor({
        id: Number(data.id),
        name: String(data.name ?? ''),
        categoryId: Number(data.categoryId),
        href: String(data.href ?? ''),
        logo: String(data.logo ?? ''),
        removeLogo: data.removeLogo === true,
      }),
    )
  })

export const showVendor = createServerFn({ method: 'POST' })
  .validator((data: { id: number; shown: boolean }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => setVendorShown(Number(data.id), data.shown === true))
  })

export const deleteVendor = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => removeVendor(Number(data.id)))
  })

export const shiftVendor = createServerFn({ method: 'POST' })
  .validator((data: { id: number; direction: 'up' | 'down' }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => moveVendor(Number(data.id), direction(data.direction)))
  })

export const saveNewVendorCategory = createServerFn({ method: 'POST' })
  .validator((data: { name: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => addVendorCategory(String(data.name ?? '')))
  })

export const renameCategory = createServerFn({ method: 'POST' })
  .validator((data: { id: number; name: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => renameVendorCategory(Number(data.id), String(data.name ?? '')))
  })

export const deleteCategory = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => removeVendorCategory(Number(data.id)))
  })

export const shiftCategory = createServerFn({ method: 'POST' })
  .validator((data: { id: number; direction: 'up' | 'down' }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return run(() => moveVendorCategory(Number(data.id), direction(data.direction)))
  })

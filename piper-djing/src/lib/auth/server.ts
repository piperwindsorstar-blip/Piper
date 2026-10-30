import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { endDeskSession, isDesk, requireDesk, startDeskSession } from './session.server.ts'

export const deskAuthed = createServerFn({ method: 'GET' }).handler(
  async () => {
    return isDesk()
  },
)

export const requireDeskPage = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (!(await isDesk())) throw redirect({ to: '/login' })
    return true
  },
)

/** Step one. A right password leads to the code, never straight in (unless trusted). */
export const signIn = createServerFn({ method: 'POST' })
  .validator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const result = await startDeskSession(String(data.password ?? ''))
    return { ok: result === 'ok', reason: result }
  })

export const startTwoFactorSetup = createServerFn({ method: 'POST' })
  .validator(() => ({}))
  .handler(async () => {
    const { startEnrollment } = await import('./two-factor.server.ts')
    return startEnrollment()
  })

export const confirmTwoFactorSetup = createServerFn({ method: 'POST' })
  .validator((data: { code: string; trust: boolean }) => data)
  .handler(async ({ data }) => {
    const { confirmEnrollment } = await import('./two-factor.server.ts')
    return confirmEnrollment(String(data.code ?? ''), data.trust === true)
  })

export const verifyTwoFactor = createServerFn({ method: 'POST' })
  .validator((data: { code: string; trust: boolean }) => data)
  .handler(async ({ data }) => {
    const { verifySecondStep } = await import('./two-factor.server.ts')
    return verifySecondStep(String(data.code ?? ''), data.trust === true)
  })

export const signOut = createServerFn({ method: 'POST' })
  .validator(() => ({}))
  .handler(async () => {
    await endDeskSession()
    return { ok: true as const }
  })

// --- Desk → Security (signed in only) --------------------------------------------------

export const getSecurity = createServerFn({ method: 'GET' }).handler(async () => {
  await requireDesk()
  const { securityStatus } = await import('./two-factor.server.ts')
  return securityStatus()
})

export const newBackupCodes = createServerFn({ method: 'POST' })
  .validator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    const { regenerateBackupCodes } = await import('./two-factor.server.ts')
    try {
      return await regenerateBackupCodes(String(data.code ?? ''))
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'That did not work.' }
    }
  })

export const forgetDevice = createServerFn({ method: 'POST' })
  .validator((data: { id: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    const { revokeAllDevices, revokeDevice } = await import('./two-factor.server.ts')
    try {
      if (data.id === 'all') await revokeAllDevices()
      else await revokeDevice(String(data.id ?? ''))
      return { ok: true as const }
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'That did not work.' }
    }
  })

export const startNewPhone = createServerFn({ method: 'POST' })
  .validator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    const { beginPhoneChange } = await import('./two-factor.server.ts')
    try {
      return await beginPhoneChange(String(data.code ?? ''))
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'That did not work.' }
    }
  })

export const confirmNewPhone = createServerFn({ method: 'POST' })
  .validator((data: { code: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    const { finishPhoneChange } = await import('./two-factor.server.ts')
    try {
      return await finishPhoneChange(String(data.code ?? ''))
    } catch (error) {
      return { ok: false as const, error: error instanceof Error ? error.message : 'That did not work.' }
    }
  })

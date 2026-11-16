import { createServerFn } from '@tanstack/react-start'
import { isDesk } from './auth/session.server.ts'

/** A backup file for the desk to download right now. */
export const downloadBackup = createServerFn({ method: 'POST' }).handler(
  async () => {
    if (!(await isDesk())) {
      return { ok: false as const, error: 'Sign in required.' }
    }
    try {
      const { readBackup } = await import('./backup.server.ts')
      const backup = await readBackup()
      return { ok: true as const, ...backup }
    } catch {
      return { ok: false as const, error: 'The backup could not be made.' }
    }
  },
)

/** When the Sunday backup email last went out, for the desk to show. */
export const getBackupStatus = createServerFn({ method: 'GET' }).handler(
  async () => {
    if (!(await isDesk())) return null
    const { lastJobRun } = await import('./job-runs.server.ts')
    return lastJobRun('backup:weekly').catch(() => null)
  },
)

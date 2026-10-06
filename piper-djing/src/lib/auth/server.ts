import { redirect } from '@tanstack/react-router'
import { createServerFn } from '@tanstack/react-start'
import { endDeskSession, isDesk, startDeskSession } from './session.server.ts'

export const deskAuthed = createServerFn({ method: 'GET' }).handler(async () => {
  return isDesk()
})

export const requireDeskPage = createServerFn({ method: 'GET' }).handler(async () => {
  if (!(await isDesk())) throw redirect({ to: '/login' })
  return true
})

export const signIn = createServerFn({ method: 'POST' })
  .validator((data: { password: string }) => data)
  .handler(async ({ data }) => {
    const ok = await startDeskSession(data.password ?? '')
    return { ok }
  })

export const signOut = createServerFn({ method: 'POST' })
  .validator(() => ({}))
  .handler(async () => {
    await endDeskSession()
    return { ok: true as const }
  })

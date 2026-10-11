import { createServerFn } from '@tanstack/react-start'
import { emailOwner } from '../crm/mail.server.ts'
import { torontoToday } from '../piper/rules.ts'
import {
  coupleBySlug,
  lockCouplePlan,
  saveCouplePlanning,
} from '../crm/store.server.ts'
import { isPlanLocked } from '../crm/planning.ts'
import { changeLetter, planLetter } from './letter.ts'
import { overallProgress } from './progress.ts'
import { coupleSlugFromCookie, rememberCoupleSlug } from './session.server.ts'

export const openCouplePortal = createServerFn({ method: 'POST' })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    const page = await coupleBySlug(data.slug)
    if (!page) return { ok: false as const }
    rememberCoupleSlug(data.slug)
    return { ok: true as const }
  })

export const getPortal = createServerFn({ method: 'GET' }).handler(async () => {
  const slug = coupleSlugFromCookie()
  if (!slug) return null
  const page = await coupleBySlug(slug)
  if (!page) return null
  const today = torontoToday()
  return {
    ...page,
    slug,
    today,
    locked: isPlanLocked(page.planning, today),
  }
})

export const savePortal = createServerFn({ method: 'POST' })
  .validator((data: { planning: unknown }) => data)
  .handler(async ({ data }) => {
    const slug = coupleSlugFromCookie()
    if (!slug)
      return { ok: false as const, error: 'Open the link Piper sent you.' }
    try {
      const planning = await saveCouplePlanning(slug, data.planning)
      return { ok: true as const, planning, locked: false }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Could not save.'
      return { ok: false as const, error: message }
    }
  })

export const sendPortalPlan = createServerFn({ method: 'POST' }).handler(
  async () => {
    const slug = coupleSlugFromCookie()
    if (!slug)
      return { ok: false as const, error: 'Open the link Piper sent you.' }
    const page = await coupleBySlug(slug)
    if (!page) return { ok: false as const, error: 'That page was not found.' }
    if (isPlanLocked(page.planning, torontoToday())) {
      return { ok: false as const, error: 'This plan is already locked.' }
    }
    const progress = overallProgress(page.planning)
    const mailed = await emailOwner(
      planLetter({
        partnerOne: page.partnerOne,
        partnerTwo: page.partnerTwo,
        eventDate: page.eventDate,
        slug,
        answered: progress.answered,
        total: progress.total,
      }),
    )
    if (!mailed.delivered) {
      return { ok: false as const, error: mailed.detail }
    }
    const planning = await lockCouplePlan(slug)
    return { ok: true as const, planning }
  },
)

export const requestPortalChange = createServerFn({ method: 'POST' })
  .validator((data: { note: string }) => data)
  .handler(async ({ data }) => {
    const slug = coupleSlugFromCookie()
    if (!slug)
      return { ok: false as const, error: 'Open the link Piper sent you.' }
    const page = await coupleBySlug(slug)
    if (!page) return { ok: false as const, error: 'That page was not found.' }
    const mailed = await emailOwner(
      changeLetter({
        partnerOne: page.partnerOne,
        partnerTwo: page.partnerTwo,
        eventDate: page.eventDate,
        slug,
        note: data.note,
      }),
    )
    if (!mailed.delivered) return { ok: false as const, error: mailed.detail }
    return { ok: true as const }
  })

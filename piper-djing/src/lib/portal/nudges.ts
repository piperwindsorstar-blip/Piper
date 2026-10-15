import { PUBLIC_EMAIL } from '../crm/defaults.ts'
import { longDate } from '../crm/dates.ts'
import { hasCoupleAddress } from '../crm/mail-copy.ts'
import type { Letter } from '../crm/mail-copy.ts'
import type { Planning } from '../crm/planning.ts'
import { shiftIso } from './progress.ts'

/**
 * Plan reminders: a short email to a booked couple whose music plan is not
 * finished, at set points before their finish-by date. Each step goes once
 * per couple; a couple who finishes, or whose plan is locked, gets nothing.
 */

export type NudgeStep =
  | 'eight-weeks'
  | 'four-weeks'
  | 'two-weeks'
  | 'one-week'
  | 'two-days'
  | 'past-due'

/** Days before the finish-by date each step covers, newest last. */
export const NUDGE_STEPS: { step: NudgeStep; from: number; to: number }[] = [
  { step: 'eight-weeks', from: 60, to: 31 },
  { step: 'four-weeks', from: 30, to: 15 },
  { step: 'two-weeks', from: 14, to: 8 },
  { step: 'one-week', from: 7, to: 3 },
  { step: 'two-days', from: 2, to: 0 },
  { step: 'past-due', from: -1, to: -Infinity },
]

export const NUDGE_LABEL: Record<NudgeStep, string> = {
  'eight-weeks': '8 weeks before',
  'four-weeks': '4 weeks before',
  'two-weeks': '2 weeks before',
  'one-week': '1 week before',
  'two-days': '2 days before',
  'past-due': 'Past the finish date',
}

/** The couple's finish-by date: the one Piper set, or 5 days before the wedding. */
export function finishDate(planning: Pick<Planning, 'dueDate'>, eventDate: string): string {
  return planning.dueDate || shiftIso(eventDate, -5)
}

/** Whole days from one ISO date to another; negative once it has passed. */
export function daysBetween(from: string, to: string): number {
  const start = Date.parse(`${from}T00:00:00Z`)
  const end = Date.parse(`${to}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.NaN
  return Math.round((end - start) / 86_400_000)
}

export function stepFor(days: number): NudgeStep | null {
  if (!Number.isFinite(days)) return null
  return NUDGE_STEPS.find((item) => days <= item.from && days >= item.to)?.step ?? null
}

export type NudgeCouple = {
  status: string
  sample: boolean
  email: string
  eventDate: string
  planning: Pick<Planning, 'dueDate' | 'planLocked'>
  percent: number
}

export type NudgeDue = { step: NudgeStep; finish: string; days: number }

/** Why a couple gets no reminder, for the desk. Empty when one is due. */
export function nudgeBlock(couple: NudgeCouple, today: string): string {
  if (couple.sample) return 'Test booking'
  if (couple.status !== 'booked') return 'Not booked yet'
  if (!(couple.eventDate > today)) return 'Wedding has passed'
  if (couple.percent >= 100) return 'Plan finished'
  const finish = finishDate(couple.planning, couple.eventDate)
  if (couple.planning.planLocked || (couple.planning.dueDate && today > couple.planning.dueDate)) {
    return 'Plan locked'
  }
  const days = daysBetween(today, finish)
  if (days > 60) return 'More than 8 weeks to go'
  if (!hasCoupleAddress(couple.email)) return 'No email on file'
  return ''
}

/** The reminder due today, or null. Sending once per step is the caller's job. */
export function nudgeDue(couple: NudgeCouple, today: string): NudgeDue | null {
  if (nudgeBlock(couple, today)) return null
  const finish = finishDate(couple.planning, couple.eventDate)
  const days = daysBetween(today, finish)
  const step = stepFor(days)
  return step ? { step, finish, days } : null
}

export function nudgeLetter(input: {
  partnerOne: string
  partnerTwo: string
  eventDate: string
  link: string
  due: NudgeDue
  answered: number
  total: number
  percent: number
  next: string
}): Letter {
  const { due } = input
  const finish = longDate(due.finish)
  const left = Math.max(0, input.total - input.answered)
  const where =
    input.answered === 0
      ? "You haven't started your music plan yet."
      : `Your music plan is ${input.percent}% done: ${input.answered} of ${input.total} answered, ${left} to go.`
  const ask =
    due.step === 'past-due'
      ? `It was due ${finish}. Send me what you have, and anything still open we can sort out together.`
      : due.step === 'two-days'
        ? `Please finish it by ${finish}. That's ${due.days === 0 ? 'today' : due.days === 1 ? 'tomorrow' : 'in two days'}.`
        : `Please finish it by ${finish} so I can build your night around it.`
  const subject =
    due.step === 'past-due'
      ? 'Your music plan is past due'
      : due.step === 'two-days'
        ? 'Your music plan is due soon'
        : input.answered === 0
          ? 'Time to start your music plan'
          : 'Your music plan: a few questions left'
  const lines = [
    `Hello ${input.partnerOne} and ${input.partnerTwo},`,
    '',
    `${where} ${ask}`,
    input.next ? `Next up: ${input.next}.` : '',
    '',
    `Open your plan: ${input.link}`,
    "It saves as you go, and you can skip anything you're not sure about yet.",
    '',
    `Wedding date: ${longDate(input.eventDate)}`,
    '',
    `Martin · Piper DJing\n${PUBLIC_EMAIL}`,
  ]
  return {
    subject,
    text: lines
      .join('\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim(),
    fromName: 'Martin at Piper DJing',
  }
}

export type NudgeRow = {
  slug: string
  couple: string
  eventDate: string
  finish: string
  percent: number
  email: string
  /** Why nothing goes out, or '' when a reminder is due or waiting. */
  block: string
  /** The step that would go out today, if any. */
  due: string
  last: { step: string; at: string; delivered: boolean; detail: string } | null
}

import { PUBLIC_EMAIL } from './defaults.ts'
import { longDate } from './dates.ts'
import { hasCoupleAddress } from './mail-copy.ts'
import type { Letter } from './mail-copy.ts'
import { cad } from './money.ts'

/**
 * Balance reminders: a friendly email to a booked couple who still owe money,
 * once about a month before the wedding and once in the last week. Each goes
 * once; a couple who has paid in full gets nothing.
 */

export type BalanceStep = 'one-month' | 'one-week'

export const BALANCE_STEPS: { step: BalanceStep; from: number; to: number }[] = [
  { step: 'one-month', from: 30, to: 8 },
  { step: 'one-week', from: 7, to: 1 },
]

export const BALANCE_LABEL: Record<BalanceStep, string> = {
  'one-month': 'About a month before',
  'one-week': 'The last week',
}

export type BalanceCouple = {
  status: string
  sample: boolean
  email: string
  eventDate: string
  invoice: { status: string; balanceCents: number } | null
}

export type BalanceDue = { step: BalanceStep; days: number; balanceCents: number }

function daysTo(today: string, day: string): number {
  const start = Date.parse(`${today}T00:00:00Z`)
  const end = Date.parse(`${day}T00:00:00Z`)
  if (!Number.isFinite(start) || !Number.isFinite(end)) return Number.NaN
  return Math.round((end - start) / 86_400_000)
}

/** Why a couple gets no balance reminder, for the desk. Empty when one can go. */
export function balanceBlock(couple: BalanceCouple, today: string): string {
  if (couple.sample) return 'Test booking'
  if (couple.status !== 'booked') return 'Not booked yet'
  if (!(couple.eventDate > today)) return 'Wedding has passed'
  if (!couple.invoice || couple.invoice.status !== 'sent') return 'Invoice not sent'
  if (couple.invoice.balanceCents <= 0) return 'Paid in full'
  if (daysTo(today, couple.eventDate) > 30) return 'More than a month to go'
  if (!hasCoupleAddress(couple.email)) return 'No email on file'
  return ''
}

export function balanceDue(couple: BalanceCouple, today: string): BalanceDue | null {
  if (balanceBlock(couple, today)) return null
  const days = daysTo(today, couple.eventDate)
  const step = BALANCE_STEPS.find((item) => days <= item.from && days >= item.to)?.step
  return step && couple.invoice
    ? { step, days, balanceCents: couple.invoice.balanceCents }
    : null
}

export function balanceLetter(input: {
  partnerOne: string
  partnerTwo: string
  eventDate: string
  due: BalanceDue
  invoiceLink: string
  card: boolean
}): Letter {
  const amount = cad(input.due.balanceCents)
  const when = longDate(input.eventDate)
  const lead =
    input.due.step === 'one-week'
      ? `Your wedding is almost here. Your remaining balance of ${amount} is due before ${when}.`
      : `Your wedding is about a month away. Your remaining balance is ${amount}, due before ${when}.`
  const ways = input.card
    ? `You can pay by e-transfer to ${PUBLIC_EMAIL} or by cash, with no HST, or by card on your invoice page (card adds 13% HST on the amount paid by card).`
    : `You can pay by e-transfer to ${PUBLIC_EMAIL} or by cash.`
  const lines = [
    `Hello ${input.partnerOne} and ${input.partnerTwo},`,
    '',
    lead,
    ways,
    '',
    `Your invoice: ${input.invoiceLink}`,
    '',
    'If it is already on its way, thank you, and you can ignore this.',
    '',
    `Martin · Piper DJing\n${PUBLIC_EMAIL}`,
  ]
  return {
    subject:
      input.due.step === 'one-week'
        ? `Balance reminder: ${amount} due before your wedding`
        : `Your balance before the big day: ${amount}`,
    text: lines.join('\n').replace(/\n{3,}/g, '\n\n').trim(),
    fromName: 'Martin at Piper DJing',
  }
}

export type BalanceRow = {
  id: number
  couple: string
  eventDate: string
  balanceCents: number
  email: string
  block: string
  due: string
  last: { step: string; at: string; delivered: boolean; detail: string } | null
}

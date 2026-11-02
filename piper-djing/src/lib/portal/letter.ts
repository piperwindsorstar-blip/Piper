import { longDate } from '../crm/dates.ts'
import type { Letter } from '../crm/mail-copy.ts'
import { publicUrl } from '../crm/safe-origin.ts'
import { pairNames } from '../crm/names.ts'

export function planLetter(input: {
  partnerOne: string
  partnerTwo: string
  eventDate: string
  slug: string
  answered: number
  total: number
}): Letter {
  return {
    subject: `Plan from ${pairNames(input.partnerOne, input.partnerTwo)}`,
    text: [
      `${pairNames(input.partnerOne, input.partnerTwo)} sent their plan.`,
      `Date: ${longDate(input.eventDate)}`,
      `Answered: ${input.answered} of ${input.total}`,
      '',
      publicUrl(`/c/${input.slug}`),
    ].join('\n'),
  }
}

export function changeLetter(input: {
  partnerOne: string
  partnerTwo: string
  eventDate: string
  slug: string
  note: string
}): Letter {
  return {
    subject: `Change request from ${pairNames(input.partnerOne, input.partnerTwo)}`,
    text: [
      `${pairNames(input.partnerOne, input.partnerTwo)} asked to change a locked plan.`,
      `Date: ${longDate(input.eventDate)}`,
      input.note.trim() ? `Note: ${input.note.trim()}` : '',
      '',
      publicUrl(`/c/${input.slug}`),
    ]
      .filter((line) => line !== '')
      .join('\n'),
  }
}

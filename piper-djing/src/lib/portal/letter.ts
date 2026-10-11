import { longDate } from '../crm/dates.ts'
import type { Letter } from '../crm/mail-copy.ts'
import { publicUrl } from '../crm/safe-origin.ts'

export function planLetter(input: {
  partnerOne: string
  partnerTwo: string
  eventDate: string
  slug: string
  answered: number
  total: number
}): Letter {
  return {
    subject: `Plan from ${input.partnerOne} and ${input.partnerTwo}`,
    text: [
      `${input.partnerOne} and ${input.partnerTwo} sent their plan.`,
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
    subject: `Change request from ${input.partnerOne} and ${input.partnerTwo}`,
    text: [
      `${input.partnerOne} and ${input.partnerTwo} asked to change a locked plan.`,
      `Date: ${longDate(input.eventDate)}`,
      input.note.trim() ? `Note: ${input.note.trim()}` : '',
      '',
      publicUrl(`/c/${input.slug}`),
    ]
      .filter((line) => line !== '')
      .join('\n'),
  }
}

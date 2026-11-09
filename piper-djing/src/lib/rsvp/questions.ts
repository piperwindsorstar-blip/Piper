import { piperQuestionEmail } from './emails.ts'
import type { RsvpEmail } from './emails.ts'

export type CoupleQuestion = {
  id: string
  rsvpId: string
  couple: string
  text: string
  askedAt: string
  reply: string
  repliedAt: string
}

export function questionLetter(question: {
  rsvpId: string
  couple: string
  text: string
  askedAt: string
}): RsvpEmail {
  return piperQuestionEmail(question)
}

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
}): { subject: string; text: string } {
  return {
    subject: `Question from ${question.couple}`,
    text: [
      `${question.couple} asked a question on their RSVP.`,
      '',
      `RSVP: ${question.rsvpId}`,
      `Time: ${question.askedAt}`,
      '',
      question.text,
    ].join('\n'),
  }
}

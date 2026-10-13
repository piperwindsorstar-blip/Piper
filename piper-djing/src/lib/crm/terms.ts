import { TRAVEL_COPY } from './travel-copy.ts'

/**
 * The one terms document. Change this text. Do not add a second document.
 * Local databases receive it once, when they are empty. An existing document
 * that still has the old deposit or travel sentences is brought forward.
 */
const DEPOSIT_PARAGRAPH =
  'A wedding or a reception on its own is deposited at 30% of the total, to the nearest $25. A remainder that lands exactly halfway rounds down. The Pre-Party, a stag and doe on its own, is a flat $350 deposit. Ceremony only, The Aisle, is $350 paid in full. A full wedding day booked with a stag and doe is one booking, and the deposit for that booking is $500. A Custom event is deposited at 30% of the agreed price unless Piper sets another deposit.'

const TRAVEL_PARAGRAPH = `Wired uplights are $15 each. ${TRAVEL_COPY}`

const SECOND_VENUE_PARAGRAPH =
  'If the ceremony is at a separate venue from the reception, a flat $75 second-venue fee applies. Two venues is the maximum; a third venue is not offered.'

const PAYMENT_PARAGRAPH =
  'You can pay by e-transfer to PiperPWeddingDJ@gmail.com, by cash, or by card. Card adds 13% HST, which is charged on the balance, not the deposit.'

const AGREEMENT_PARAGRAPH =
  '4.5 Sending the deposit, or paying Ceremony only in full, is agreement to these terms. A signature is extra proof of that agreement. A signature by itself does not hold and does not book a date.'

const BOOKED_PARAGRAPH =
  'Once a date is booked, later payments, refunds, and edits do not release it. Only a cancellation or a release changes that status.'

const PREVIOUS_DEPOSIT =
  'The deposit is 30% of the total, to the nearest $25. A remainder that lands exactly halfway rounds down. Ceremony only is paid in full. A full wedding day booked with a stag and doe is one booking, and the deposit for that booking is $500.'

const PREVIOUS_TRAVEL =
  'Wired uplights are $15 each. Travel is calculated from the kilometres to each venue. Two venues is the maximum.'

/** The venue fee rode at the end of the travel paragraph before it became a clause. */
const VENUE_TAIL =
  ' A separate ceremony venue is $75. A third venue is not offered.'

const LEGACY_TRAVEL_PARAGRAPH = `${TRAVEL_PARAGRAPH}${VENUE_TAIL}`

export const TERMS_BODY = `Piper DJing

A date moves from open, to a hold, to booked. It does not move backward. A hold starts when the invoice is sent and the booking has a venue name and a street. The hold date is that day in Toronto. The hold runs 30 days, counting the day it starts.

${DEPOSIT_PARAGRAPH}

${TRAVEL_PARAGRAPH}

${SECOND_VENUE_PARAGRAPH}

${PAYMENT_PARAGRAPH}

${AGREEMENT_PARAGRAPH}

${BOOKED_PARAGRAPH}`

export function reviseTerms(body: string): string {
  let next = body
  if (next.includes(PREVIOUS_DEPOSIT) || next.includes(PREVIOUS_TRAVEL)) {
    next = next
      .replace(PREVIOUS_DEPOSIT, DEPOSIT_PARAGRAPH)
      .replace(PREVIOUS_TRAVEL, TRAVEL_PARAGRAPH)
  }
  if (next.includes(LEGACY_TRAVEL_PARAGRAPH)) {
    next = next.replace(LEGACY_TRAVEL_PARAGRAPH, TRAVEL_PARAGRAPH)
  }
  if (!next.includes(SECOND_VENUE_PARAGRAPH)) {
    next = next.replace(
      TRAVEL_PARAGRAPH,
      `${TRAVEL_PARAGRAPH}\n\n${SECOND_VENUE_PARAGRAPH}`,
    )
  }
  if (!next.includes(PAYMENT_PARAGRAPH) || !next.includes(AGREEMENT_PARAGRAPH)) {
    next = next.replace(
      BOOKED_PARAGRAPH,
      `${PAYMENT_PARAGRAPH}\n\n${AGREEMENT_PARAGRAPH}\n\n${BOOKED_PARAGRAPH}`,
    )
  }
  return next
}

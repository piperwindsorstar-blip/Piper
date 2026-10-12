import { DESK_TRAVEL_COPY } from './travel-copy.ts'

/**
 * The one terms document. Change this text. Do not add a second document.
 * Local databases receive it once, when they are empty. An existing document
 * that still has the old deposit or travel sentences is brought forward.
 */
const DEPOSIT_PARAGRAPH =
  'A wedding or a reception on its own is deposited at 30% of the total, to the nearest $25. A remainder that lands exactly halfway rounds down. The Pre-Party, a stag and doe on its own, is a flat $350 deposit. Ceremony only, The Aisle, is $350 paid in full. A full wedding day booked with a stag and doe is one booking, and the deposit for that booking is $500.'

const TRAVEL_PARAGRAPH = `Wired uplights are $15 each. ${DESK_TRAVEL_COPY}`

const PREVIOUS_DEPOSIT =
  'The deposit is 30% of the total, to the nearest $25. A remainder that lands exactly halfway rounds down. Ceremony only is paid in full. A full wedding day booked with a stag and doe is one booking, and the deposit for that booking is $500.'

const PREVIOUS_TRAVEL =
  'Wired uplights are $15 each. Travel is calculated from the kilometres to each venue. Two venues is the maximum.'

export const TERMS_BODY = `Piper DJing

A date moves from open, to a hold, to booked. It does not move backward. A hold starts when the invoice is sent and the booking has a venue name and a street. The hold date is that day in Toronto. The hold runs 30 days, counting the day it starts.

${DEPOSIT_PARAGRAPH}

${TRAVEL_PARAGRAPH}

Once a date is booked, later payments, refunds, and edits do not release it. Only a cancellation or a release changes that status.`

export function reviseTerms(body: string): string {
  if (!body.includes(PREVIOUS_DEPOSIT) && !body.includes(PREVIOUS_TRAVEL)) {
    return body
  }
  return body
    .replace(PREVIOUS_DEPOSIT, DEPOSIT_PARAGRAPH)
    .replace(PREVIOUS_TRAVEL, TRAVEL_PARAGRAPH)
}

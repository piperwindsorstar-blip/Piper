import { PACKAGE_CENTS } from '../piper/rules.ts'
import { publicPackagePrice } from './packages.ts'
import { TRAVEL_COPY } from './travel-copy.ts'

/**
 * The one terms document. Change this text. Do not add a second document.
 * Local databases receive it once, when they are empty. An existing document
 * that still has an older sentence is brought forward.
 */
const DEPOSIT_PARAGRAPH =
  'A wedding or a reception on its own is deposited at 30% of the total, to the nearest $25. A remainder that lands exactly halfway rounds down. The Pre-Party, a stag and doe on its own, is a flat $350 deposit. Ceremony only, The Aisle, is $350 paid in full. A full wedding day booked with a stag and doe is one booking, and the deposit for that booking is $500. A Custom event is deposited at 30% of the agreed price unless Piper sets another deposit.'

/** The four packages and the rules around them, as /weddings states them. */
const PACKAGE_PARAGRAPH = `The Main Event, a full wedding day, is ${publicPackagePrice('full', PACKAGE_CENTS.full)}. The After Party, reception only, is ${publicPackagePrice('reception', PACKAGE_CENTS.reception)}. The Pre-Party, a stag and doe, is ${publicPackagePrice('stag', PACKAGE_CENTS.stag)}. The Aisle, ceremony only, is ${publicPackagePrice('ceremony', PACKAGE_CENTS.ceremony)}. The Main Event and The Pre-Party booked together are $250 off. Every package covers the night up to 1:00 a.m. Overtime after 1:00 a.m. is $250 an hour.`

/** A stable opening, so a later price change does not add a second copy. */
const PACKAGE_LEAD = 'The Main Event, a full wedding day, is '

const TRAVEL_PARAGRAPH = `Wired uplights are $15 each. ${TRAVEL_COPY}`

const SECOND_VENUE_PARAGRAPH =
  'If the ceremony is at a separate venue from the reception, a flat $75 second-venue fee applies. Two venues is the maximum; a third venue is not offered.'

const PAYMENT_PARAGRAPH =
  'You can pay by e-transfer to PiperPWeddingDJ@gmail.com, by cash, or by card. Card payments toward the balance carry 13% HST on the amount paid by card. Deposits, e-transfer and cash carry no HST.'

/** The payment wording before card HST was per card payment (Oct 2026). */
const PREVIOUS_PAYMENT_PARAGRAPH =
  'You can pay by e-transfer to PiperPWeddingDJ@gmail.com, by cash, or by card. Card adds 13% HST, which is charged on the balance, not the deposit.'

/** Keeps the first copy of a paragraph and drops any later repeats. */
function keepFirst(body: string, paragraph: string): string {
  const first = body.indexOf(paragraph)
  if (first < 0) return body
  const head = body.slice(0, first + paragraph.length)
  const tail = body
    .slice(first + paragraph.length)
    .split(`\n\n${paragraph}`)
    .join('')
  return head + tail
}

const AGREEMENT_PARAGRAPH =
  '4.5 Sending the deposit, or paying Ceremony only in full, is agreement to these terms. A signature is extra proof of that agreement. A signature by itself does not hold and does not book a date.'

const BOOKED_PARAGRAPH =
  'Once a date is booked, later payments, refunds, and edits do not release it. Only a cancellation or a release changes that status.'

/* --- Older wording, brought forward on the next boot. --- */

const PREVIOUS_DEPOSIT =
  'The deposit is 30% of the total, to the nearest $25. A remainder that lands exactly halfway rounds down. Ceremony only is paid in full. A full wedding day booked with a stag and doe is one booking, and the deposit for that booking is $500.'

const PREVIOUS_TRAVEL =
  'Wired uplights are $15 each. Travel is calculated from the kilometres to each venue. Two venues is the maximum.'

/** Deposits before the Custom event was sold. */
const PREVIOUS_DEPOSIT_NO_CUSTOM =
  'A wedding or a reception on its own is deposited at 30% of the total, to the nearest $25. A remainder that lands exactly halfway rounds down. The Pre-Party, a stag and doe on its own, is a flat $350 deposit. Ceremony only, The Aisle, is $350 paid in full. A full wedding day booked with a stag and doe is one booking, and the deposit for that booking is $500.'

/** The venue fee rode at the end of the travel paragraph before it became a clause. */
const VENUE_TAIL =
  ' A separate ceremony venue is $75. A third venue is not offered.'

const LEGACY_TRAVEL_PARAGRAPH = `${TRAVEL_PARAGRAPH}${VENUE_TAIL}`

/** The old travel copy ended with this sentence. */
const PREVIOUS_VENUE_SENTENCE = 'Two venues is the maximum.'

const PREVIOUS_TRAVEL_PARAGRAPH = `${TRAVEL_PARAGRAPH} ${PREVIOUS_VENUE_SENTENCE}`

/** The venue clause, with that old sentence left stranded after it. */
const PREVIOUS_SECOND_VENUE_PARAGRAPH = `${SECOND_VENUE_PARAGRAPH} ${PREVIOUS_VENUE_SENTENCE}`

export const TERMS_BODY = `Piper DJing

A date moves from open, to a hold, to booked. It does not move backward. A hold starts when the invoice is sent and the booking has a venue name and a street. The hold date is that day in Toronto. The hold runs 30 days, counting the day it starts.

${PACKAGE_PARAGRAPH}

${DEPOSIT_PARAGRAPH}

${TRAVEL_PARAGRAPH}

${SECOND_VENUE_PARAGRAPH}

${PAYMENT_PARAGRAPH}

${AGREEMENT_PARAGRAPH}

${BOOKED_PARAGRAPH}`

export function reviseTerms(body: string): string {
  let next = body
  // Older payment wording becomes the current one; a document that got both
  // (one start inserted the new paragraph beside the old) keeps one copy.
  next = next.split(PREVIOUS_PAYMENT_PARAGRAPH).join(PAYMENT_PARAGRAPH)
  next = keepFirst(next, PAYMENT_PARAGRAPH)
  next = keepFirst(next, AGREEMENT_PARAGRAPH)
  if (next.includes(PREVIOUS_DEPOSIT) || next.includes(PREVIOUS_TRAVEL)) {
    next = next
      .replace(PREVIOUS_DEPOSIT, DEPOSIT_PARAGRAPH)
      .replace(PREVIOUS_TRAVEL, TRAVEL_PARAGRAPH)
  }
  // The older deposit paragraph is a prefix of the current one, so only move it
  // when the current sentence is missing.
  if (
    !next.includes(DEPOSIT_PARAGRAPH) &&
    next.includes(PREVIOUS_DEPOSIT_NO_CUSTOM)
  ) {
    next = next.replace(PREVIOUS_DEPOSIT_NO_CUSTOM, DEPOSIT_PARAGRAPH)
  }
  if (next.includes(LEGACY_TRAVEL_PARAGRAPH)) {
    next = next.replace(LEGACY_TRAVEL_PARAGRAPH, TRAVEL_PARAGRAPH)
  }
  if (next.includes(PREVIOUS_TRAVEL_PARAGRAPH)) {
    next = next.replace(PREVIOUS_TRAVEL_PARAGRAPH, TRAVEL_PARAGRAPH)
  }
  if (next.includes(PREVIOUS_SECOND_VENUE_PARAGRAPH)) {
    next = next.replace(PREVIOUS_SECOND_VENUE_PARAGRAPH, SECOND_VENUE_PARAGRAPH)
  }
  if (!next.includes(SECOND_VENUE_PARAGRAPH)) {
    next = next.replace(
      TRAVEL_PARAGRAPH,
      `${TRAVEL_PARAGRAPH}\n\n${SECOND_VENUE_PARAGRAPH}`,
    )
  }
  if (!next.includes(PACKAGE_LEAD)) {
    next = next.replace(
      DEPOSIT_PARAGRAPH,
      `${PACKAGE_PARAGRAPH}\n\n${DEPOSIT_PARAGRAPH}`,
    )
  }
  if (
    !next.includes(PAYMENT_PARAGRAPH) ||
    !next.includes(AGREEMENT_PARAGRAPH)
  ) {
    next = next.replace(
      BOOKED_PARAGRAPH,
      `${PAYMENT_PARAGRAPH}\n\n${AGREEMENT_PARAGRAPH}\n\n${BOOKED_PARAGRAPH}`,
    )
  }
  return next
}

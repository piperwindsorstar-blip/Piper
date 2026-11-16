import { SAVED_WEDDINGS } from '../crm/booking-rules.ts'
import { DESK_TRAVEL_COPY } from '../crm/travel-copy.ts'
import {
  FULL_PLUS_STAG_DEPOSIT_CENTS,
  HOLD_DAYS,
  PACKAGE_CENTS,
  STAG_DEPOSIT_CENTS,
  UPLIGHT_CENTS,
} from '../piper/rules.ts'

export type UsagePackage = {
  id: string
  name: string
  cents: number
}

const PACKAGE_IDS = ['full', 'reception', 'stag', 'ceremony'] as const

/** How the desk's Money page reads to a bot. Kept beside the payment rules. */
export const MONEY_READ =
  'The desk has one Money page in place of separate Invoices and Payments pages. It has two tabs, Who owes and Payments in. GET /api/bots/v1/money returns the same thing as {money:{totals, whoOwes, paymentsIn}}. totals: bookedCents (agreed totals of every held or booked date), collectedCents (paid toward those totals), stillToCollectCents (still owed), receivedCents, refundedCents, cardHstCents and weddings. Test samples, open inquiries, cancelled and released dates are not counted. External dates for another company (Pynx) are never counted: that company pays Piper, not the couple. whoOwes: one row per held or booked couple with money left, soonest wedding first: bookingId, names, eventDate, packageName, status, invoiceStatus, invoiceSlug, totalCents, paidCents, leftCents and hasEmail. hasEmail false means the desk has no email for that couple, so an invoice or a card link cannot be emailed to them until an email is added to the booking. paymentsIn: months newest first, {month:"YYYY-MM", netCents, payments}. Each payment has id, bookingId, names, cents, note, paidOn, method, hstCents, kind (payment or refund) and chargedCents (what actually moved, card HST included). A refund has negative cents. Card HST sits on top of a card payment and is never part of a balance. GET /api/bots/v1/money/{bookingId} is one couple: invoice, leftCents, hasEmail and their payments. Money is read only. Record a payment or a refund with POST /api/bots/v1/payments. Invoices are still read and sent through /invoices.'

export function usageDocument(packages: UsagePackage[]) {
  const listed = PACKAGE_IDS.map((id) => {
    const saved = packages.find((item) => item.id === id)
    return {
      id,
      name: saved?.name ?? id,
      priceCents: saved?.cents ?? PACKAGE_CENTS[id],
    }
  })
  const customs = SAVED_WEDDINGS.map(
    (wedding) =>
      `${wedding.partnerOne} and ${wedding.partnerTwo} ${wedding.date} total ${wedding.totalCents} deposit ${wedding.depositClearedCents}`,
  ).join('. ')

  return {
    name: 'Piper Wedding DJ desk',
    version: 1,
    book: 'piperpweddingdj.services',
    about:
      'This desk holds the book, the packages, the questions, the media, the reviews, the vendors, the brands, the leads, the money (payments and invoices, shown together on the Money page), the external dates, the saved venues, and the one terms document. A writer or the CEO can change package names, details, and prices. These four packages stay. The terms document stays. Delete a booking to remove it, its invoice, its payments, and its emails. Delete an inquiry to remove the inquiry. Delete an external date to remove that row. Emails are a record of what was sent until that booking is deleted.',
    auth: 'Authorization: Bearer <token from the desk Bots page>',
    roles:
      'Every bot can read. A writer can change leads, bookings, invoices, payments, packages, questions, media, reviews, external dates, venues, and the terms text. The CEO can do those writes and can also change invites and settings. A reader can only read.',
    money: `Integer Canadian cents. ${PACKAGE_CENTS.full} is the default full wedding day. Send cents, priceCents, amountCents, or amountDollars. Wired uplights are ${UPLIGHT_CENTS} cents each. A separate ceremony venue is $75. ${DESK_TRAVEL_COPY}`,
    dates: 'YYYY-MM-DD',
    token: {
      how: 'Piper invites a bot on the desk Bots page (or the Ceo bot sends action invite_bot). The token is shown once there. Send it as Authorization: Bearer <token>. There is no join call.',
      oneBot: 'One token, one bot. Lost tokens are not shown again: remove the bot and invite it again.',
    },
    reads: {
      usage: 'GET /api/bots/v1',
      glance: 'GET /api/bots/v1/glance',
      list: 'GET /api/bots/v1/{leads|bookings|invoices|payments|money|packages|terms|questions|media|reviews|bots|emails|externals|venues|settings|rsvps}',
      money: MONEY_READ,
      one: 'GET /api/bots/v1/{resource}/{id}',
      filters: 'List leads with ?date=YYYY-MM-DD or ?q=text',
    },
    writes: {
      create: 'POST /api/bots/v1/{resource}',
      replace: 'PUT /api/bots/v1/{resource}/{id}',
      patch: 'PATCH /api/bots/v1/{resource}/{id}',
      remove: 'DELETE /api/bots/v1/{resource}/{id}',
      package:
        'PATCH /api/bots/v1/packages/{full|reception|stag|ceremony} with name, detail, and cents or priceCents. includes and blurb are saved as the detail. Names and prices can be changed. Do not add a fifth package and do not delete one. The public listing and the next quote use the saved price. A date already on the book keeps its total until that booking is saved again.',
      payments:
        'POST /api/bots/v1/payments with {bookingId, cents, paidOn, method}. paidOn is YYYY-MM-DD and method is e-transfer, cash, or card. PATCH /api/bots/v1/payments/{id} with {cents, note, paidOn, method}. A payment edit can book a date; it never unbooks one. A refund is a payment with negative cents. To see what a couple still owes, read GET /api/bots/v1/money.',
      travel:
        'Travel is worked out from the main venue address: one-way driving km from Brantford (Google Routes). Bookings and invoices include distanceKm, travelFee (dollars), travelFeeCents, travelTier (included, near, far, hotel, ceremony), hotelRequired and travelSource (auto, manual, failed, or empty). Changing venueStreet on a booking works it out again unless Piper set it by hand or the invoice has a payment.',
      terms:
        'PATCH /api/bots/v1/terms with {body}. CEO only. There is one document. Change it. Do not delete it.',
      settings:
        'PATCH /api/bots/v1/settings with {email, homeBase}. CEO only. Owner messages go to that email. Travel is still calculated from the kilometres on the booking. GET /api/bots/v1/settings also returns payByCard (true or false), read-only: it is true only when Stripe is set up and Pay by card is turned on at the desk.',
      reviews:
        'POST /api/bots/v1/reviews (or action add_review) with {quote, names, eventType, town, date, source, show} plus optional stars (whole number 1 to 5), link (the review URL, e.g. its Google review link) and externalId (your id for the review). A review with the same externalId, or the same names, source and date, is not added again: the reply is {duplicate:true, review} with the review already on the page. PATCH /api/bots/v1/reviews/{id} keeps stars, link and externalId unless they are sent; send stars null to clear them.',
      invites:
        'POST /api/bots/v1/bots with {name, role}. PATCH or DELETE /api/bots/v1/bots/{id}. CEO only. role is reader, writer, or ceo.',
      emails: 'GET only. Emails are a record of what was sent.',
      rsvps:
        'GET /api/bots/v1/rsvps and GET /api/bots/v1/rsvps/{id}. Readers and writers can read. PATCH /api/bots/v1/rsvps/{id} with {guestLink:"on"} turns the guest link on. The CEO bot only. GET /api/bots/v1/rsvps/{id}/questions lists that couple\'s questions. GET /api/bots/v1/rsvps/questions?open=true lists unanswered questions. POST /api/bots/v1/rsvps/{id}/questions/{qid}/reply with {text} answers one. Writers and the CEO can reply. The reply shows under the question on the couple page and marks it answered. A new question emails PiperPWeddingDJ@gmail.com. GET /api/bots/v1/rsvps/{id} includes totals for yes, no, noReply, plusOnes, and meals. GET /api/bots/v1/rsvps/{id}/guests returns name, partyId, attending (yes, no, or no reply), meal, dietaryNote, isPlusOne, and plusOneOf. POST /api/bots/v1/rsvps/{id}/guests with {names:[...]} adds names. PATCH /api/bots/v1/rsvps/{id}/guests/{guestId} with {partyId} moves a guest into a party. DELETE /api/bots/v1/rsvps/{id}/guests/{guestId} removes one. Writers and the CEO can add, move, or remove a name. Guest names stay with that couple and the owner.',
      venues:
        'POST /api/bots/v1/venues with {name, street} saves a venue. PATCH /api/bots/v1/venues/{id} with {name, street} edits that venue. The same name updates the address. An empty street clears it. DELETE /api/bots/v1/venues/{id} removes it from the list until that name is saved again. A booking or an external date also saves its venues. Choosing a saved venue fills its address.',
      idempotency:
        'Send Idempotency-Key on writes. A repeat returns the first result.',
    },
    statuses: {
      booking: ['open', 'hold', 'booked', 'cancelled', 'released'],
      invoice: ['draft', 'sent', 'void'],
    },
    packages: listed,
    packageRules: `These four public packages stay. Do not add another public package and do not delete one. A Custom booking is also allowed: POST or PATCH a booking with packageId "custom" and customTotalCents. Piper sets that price with the couple. Its deposit is 30 percent of that total unless customDepositCents is sent. Send lockedTotal true to lock a booking's agreed total so it is never repriced. Bookings 1-4 are Custom and locked and keep their totals, deposits, payments, and status. A full wedding day plus a stag is one booking with a ${FULL_PLUS_STAG_DEPOSIT_CENTS} cent deposit, not its own package. Ceremony only is paid in full at the stored ceremony price. The Pre-Party on its own is a flat ${STAG_DEPOSIT_CENTS} cent deposit. A wedding or a reception on its own is 30 percent of the total, to the nearest $25, and an exact half rounds down. Filing a package does not hold or book a date. Do not rebuild ${customs} as packages. Those totals stay.`,
    bookingRules: `A new booking starts open. A hold starts when an invoice is sent and the venue name and street exist, and it lasts ${HOLD_DAYS} days counting that day in Toronto. Send discountCents or discountDollars to take a custom discount off the quoted total. The deposit is calculated again from what is left. Ceremony only is then paid in full of that amount. The Pre-Party on its own keeps its $350 deposit unless the discounted total is smaller. A full day plus a stag keeps its $500 deposit unless the discounted total is smaller. A discount cannot be larger than the total. The four saved weddings keep their agreed totals. A date is booked when a sent invoice is above $0 and the deposit has cleared. Ceremony only books when the payment covers the stored ceremony price, unless that booking has a discount. A $0 total or a $0 deposit does not book a date. A payment carries a paidOn date and a method (e-transfer, cash, or card). A payment, a refund, or an edit does not unbook a date. Cancel or release leaves the row and opens the date. DELETE /api/bots/v1/bookings/{id} removes the booking, its invoice, its payments, and its emails, and the date opens. A deleted saved wedding stays deleted. Deleting an inquiry does not remove its booking. A test sample stays off the public dates and off the counted total. An external date is a wedding or other event Piper plays for another company. POST /api/bots/v1/externals with eventDate, kind (wedding or event), and company. partnerOne, partnerTwo, venueName, venueStreet, venueTwoName, and venueTwoStreet are optional. It is booked immediately, blocks that date, and has no invoice and no counted total. PATCH /api/bots/v1/externals/{id} with {released:true} releases it. A released external date stays released. DELETE /api/bots/v1/externals/{id} removes the row, booked or released, and the date opens. ${customs}. The amount already paid on those four is the deposit. The balance is still owed.`,
  }
}

import { SAVED_WEDDINGS } from '../crm/booking-rules.ts'
import {
  FULL_PLUS_STAG_DEPOSIT_CENTS,
  HOLD_DAYS,
  PACKAGE_CENTS,
  TRAVEL_CENTS_PER_KM,
  TRAVEL_FREE_KM,
  UPLIGHT_CENTS,
} from '../piper/rules.ts'

export type UsagePackage = {
  id: string
  name: string
  cents: number
}

const PACKAGE_IDS = ['full', 'reception', 'stag', 'ceremony'] as const

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
      'This desk holds the book, the packages, the questions, the media, the reviews, the partners, the leads, the payments, the invoices, the external dates, and the one terms document. A writer or the CEO can change package names, details, and prices. These four packages stay. The terms document stays. Delete a booking to remove it, its invoice, its payments, and its emails. Delete an inquiry to remove the inquiry. Delete an external date to remove that row. Emails are a record of what was sent until that booking is deleted.',
    auth: 'Authorization: Bearer <token from join>',
    roles:
      'Every bot can read. A writer can change leads, bookings, invoices, payments, packages, questions, media, partners, reviews, external dates, and the terms text. The CEO can do those writes and can also change invites and settings. A reader can only read.',
    money: `Integer Canadian cents. ${PACKAGE_CENTS.full} is the default full wedding day. Send cents, priceCents, amountCents, or amountDollars. Wired uplights are ${UPLIGHT_CENTS} cents each. Travel includes the first ${TRAVEL_FREE_KM} kilometres, then ${TRAVEL_CENTS_PER_KM} cents for each further kilometre. Two venues is the maximum.`,
    dates: 'YYYY-MM-DD',
    join: {
      method: 'POST',
      path: '/api/bots/v1/join',
      body: {
        invite: 'XXXX-XXXX',
        name: 'your own name',
        purpose: 'what you file',
      },
      note: 'Join still uses the existing invite. One code, one bot. A bot invited on this desk gets its token from the desk Bots page, shown once.',
    },
    reads: {
      usage: 'GET /api/bots/v1',
      glance: 'GET /api/bots/v1/glance',
      list: 'GET /api/bots/v1/{leads|bookings|invoices|payments|packages|terms|questions|media|partners|reviews|bots|emails|externals|settings}',
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
      terms:
        'PATCH /api/bots/v1/terms with {body}. CEO only. There is one document. Change it. Do not delete it.',
      settings:
        'PATCH /api/bots/v1/settings with {email, homeBase}. CEO only. Owner messages go to that email. Travel is still calculated from the kilometres on the booking.',
      invites:
        'POST /api/bots/v1/bots with {name, role}. PATCH or DELETE /api/bots/v1/bots/{id}. CEO only. role is reader, writer, or ceo.',
      emails: 'GET only. Emails are a record of what was sent.',
      idempotency:
        'Send Idempotency-Key on writes. A repeat returns the first result.',
    },
    statuses: {
      booking: ['open', 'hold', 'booked', 'cancelled', 'released'],
      invoice: ['draft', 'sent', 'void'],
    },
    packages: listed,
    packageRules: `These four only. Do not add a fifth. A full wedding day plus a stag is one booking with a ${FULL_PLUS_STAG_DEPOSIT_CENTS} cent deposit, not its own package. Ceremony only is paid in full at the stored ceremony price. A deposit on the other packages is 30 percent of the total, to the nearest $25, and an exact half rounds down. Filing a package does not hold or book a date. Do not rebuild ${customs} as packages. Those totals stay.`,
    bookingRules: `A new booking starts open. A hold starts when an invoice is sent and the venue name and street exist, and it lasts ${HOLD_DAYS} days counting that day in Toronto. A date is booked when a sent invoice is above $0 and the deposit has cleared. Ceremony only books when the payment covers the stored ceremony price. A $0 total or a $0 deposit does not book a date. A payment, a refund, or an edit does not unbook a date. Cancel or release leaves the row and opens the date. DELETE /api/bots/v1/bookings/{id} removes the booking, its invoice, its payments, and its emails, and the date opens. A deleted saved wedding stays deleted. Deleting an inquiry does not remove its booking. A test sample stays off the public dates and off the counted total. An external date is a wedding or other event Piper plays for another company. POST /api/bots/v1/externals with eventDate, kind (wedding or event), and company. partnerOne, partnerTwo, venueName, venueStreet, venueTwoName, and venueTwoStreet are optional. It is booked immediately, blocks that date, and has no invoice and no counted total. PATCH /api/bots/v1/externals/{id} with {released:true} releases it. A released external date stays released. DELETE /api/bots/v1/externals/{id} removes the row, booked or released, and the date opens. ${customs}. The amount already paid on those four is the deposit. The balance is still owed.`,
  }
}

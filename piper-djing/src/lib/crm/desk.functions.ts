import { createServerFn } from '@tanstack/react-start'
import { requireDesk } from '../auth/session.server.ts'
import { DESK_OWNER_EMAIL } from './desk-owner.ts'
import { HOME_BASE } from './home-base.ts'
import {
  emailBooking,
  emailInvoice,
  listEmails,
  mailStatus,
} from './mail.server.ts'
import { PACKAGE_CENTS } from '../piper/rules.ts'
import { PACKAGE_BUTTON_COPY } from './defaults.ts'
import {
  addMedia,
  addPayment,
  addQuestion,
  coupleBySlug,
  createBooking,
  countedTotal,
  getTerms,
  inviteBot,
  invoiceBySlug,
  listBots,
  listBookings,
  listLeads,
  addPartner,
  listMedia,
  listPartners,
  listPayments,
  listQuestions,
  removePartner,
  sendInvoice,
  setBookingStatus,
  updateBooking,
  kindWordsOn,
  setKindWords,
  updateTerms,
  voidBookingInvoice,
  type BookingPatch,
} from './store.server.ts'

function fail(error: unknown) {
  return {
    ok: false as const,
    error: error instanceof Error ? error.message : 'That did not save.',
  }
}

export const getOverview = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    const bookings = await listBookings()
    return {
      bookings: bookings.length,
      leads: (await listLeads()).length,
      totalCents: await countedTotal(),
      upcoming: bookings.filter(
        (booking) =>
          !booking.sample &&
          (booking.status === 'hold' || booking.status === 'booked'),
      ),
    }
  },
)

export const getBookings = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    return listBookings()
  },
)

export const getInvoices = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    return listBookings()
  },
)

export const getPayments = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    const [bookings, payments] = await Promise.all([
      listBookings(),
      listPayments(),
    ])
    return { bookings, payments }
  },
)

export const getLeads = createServerFn({ method: 'GET' }).handler(async () => {
  await requireDesk()
  return listLeads()
})

export const getPackages = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    return PACKAGE_BUTTON_COPY.map((item) => ({
      id: item.id,
      name: item.name,
      detail: item.detail,
      cents: PACKAGE_CENTS[item.id],
    }))
  },
)

export const getTermsPage = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    return { body: await getTerms() }
  },
)

export const getQuestions = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    return listQuestions()
  },
)

export const getMedia = createServerFn({ method: 'GET' }).handler(async () => {
  await requireDesk()
  return listMedia()
})

export const getPartners = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    return listPartners()
  },
)

export const savePartner = createServerFn({ method: 'POST' })
  .validator((data: { name: string; href: string; logo: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, partner: await addPartner(data) }
    } catch (error) {
      return fail(error)
    }
  })

export const deletePartner = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await removePartner(data.id)
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const getBots = createServerFn({ method: 'GET' }).handler(async () => {
  await requireDesk()
  return listBots()
})

export const getSettings = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    const mail = mailStatus()
    return {
      email: DESK_OWNER_EMAIL,
      homeBase: HOME_BASE,
      localBook: !process.env.DATABASE_URL,
      mailReady: mail.ready,
      mailFrom: mail.from,
      kindWords: await kindWordsOn(),
      emails: await listEmails(),
    }
  },
)

export const saveKindWords = createServerFn({ method: 'POST' })
  .validator((data: { on: boolean }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, on: await setKindWords(data.on) }
    } catch (error) {
      return fail(error)
    }
  })

export const getCouple = createServerFn({ method: 'POST' })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => coupleBySlug(data.slug))

export const getInvoicePage = createServerFn({ method: 'POST' })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => invoiceBySlug(data.slug))

export const saveBooking = createServerFn({ method: 'POST' })
  .validator((data: BookingPatch) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, booking: await updateBooking(data) }
    } catch (error) {
      return fail(error)
    }
  })

export const addBooking = createServerFn({ method: 'POST' })
  .validator((data: Omit<BookingPatch, 'id'>) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, booking: await createBooking(data) }
    } catch (error) {
      return fail(error)
    }
  })

export const changeStatus = createServerFn({ method: 'POST' })
  .validator(
    (data: { id: number; action: 'release' | 'cancel' | 'release-stag' }) =>
      data,
  )
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        booking: await setBookingStatus(data.id, data.action),
      }
    } catch (error) {
      return fail(error)
    }
  })

export const markSent = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      const result = await sendInvoice(data.id)
      return { ok: true as const, newlyBooked: result.newlyBooked }
    } catch (error) {
      return fail(error)
    }
  })

export const markVoid = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await voidBookingInvoice(data.id)
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const recordPayment = createServerFn({ method: 'POST' })
  .validator((data: { id: number; cents: number; note: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      const result = await addPayment(data.id, data.cents, data.note)
      return { ok: true as const, newlyBooked: result.newlyBooked }
    } catch (error) {
      return fail(error)
    }
  })

export const saveTerms = createServerFn({ method: 'POST' })
  .validator((data: { body: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, body: await updateTerms(data.body) }
    } catch (error) {
      return fail(error)
    }
  })

export const saveQuestion = createServerFn({ method: 'POST' })
  .validator((data: { prompt: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await addQuestion(data.prompt)
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const saveMedia = createServerFn({ method: 'POST' })
  .validator((data: { title: string; url: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await addMedia(data.title, data.url)
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const sendBookingMail = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, ...(await emailBooking(data.id)) }
    } catch (error) {
      return fail(error)
    }
  })

export const sendInvoiceMail = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, ...(await emailInvoice(data.id)) }
    } catch (error) {
      return fail(error)
    }
  })

export const saveBot = createServerFn({ method: 'POST' })
  .validator((data: { name: string; role: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, ...(await inviteBot(data.name, data.role)) }
    } catch (error) {
      return fail(error)
    }
  })

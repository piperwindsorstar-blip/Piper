import { createServerFn } from '@tanstack/react-start'
import { requireDesk } from '../auth/session.server.ts'
import { usesEdgeBook } from '../db.server.ts'
import {
  emailBooking,
  emailInvoice,
  listEmails,
  mailStatus,
} from './mail.server.ts'
import type { ReviewDraft } from './reviews.ts'
import {
  addMedia,
  addPayment,
  addQuestion,
  coupleBySlug,
  saveCouplePlanning,
  bookExternalDate,
  createBooking,
  countedTotal,
  listExternalDates,
  releaseExternalDate,
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
  addReview,
  listReviews,
  removeReview,
  setReviewShown,
  updateReview,
  updateTerms,
  voidBookingInvoice,
  listPackageOffers,
  updatePackageOffer,
  updateQuestion,
  removeQuestion,
  updateMedia,
  removeMedia,
  updateLead,
  removeLead,
  updatePartner,
  updatePayment,
  removePayment,
  deskProfile,
  saveDeskProfile,
  updateBot,
  removeBot,
} from './store.server.ts'
import type { BookingPatch } from './store.server.ts'

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
      external: (await listExternalDates()).filter((row) => !row.released),
    }
  },
)

export const getExternalDates = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    return listExternalDates()
  },
)

export const addExternalDate = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      eventDate: string
      kind: string
      company: string
      label: string
      partnerOne: string
      partnerTwo: string
      venueName: string
      venueStreet: string
      venueTwoName: string
      venueTwoStreet: string
      notes: string
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, external: await bookExternalDate(data) }
    } catch (error) {
      return fail(error)
    }
  })

export const releaseExternal = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        external: await releaseExternalDate(data.id),
      }
    } catch (error) {
      return fail(error)
    }
  })

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
    return listPackageOffers()
  },
)

export const savePackage = createServerFn({ method: 'POST' })
  .validator(
    (data: { id: string; name: string; detail: string; cents: number }) => data,
  )
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, package: await updatePackageOffer(data) }
    } catch (error) {
      return fail(error)
    }
  })

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

export const getReviews = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    return listReviews()
  },
)

export const getSettings = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    const mail = mailStatus()
    return {
      ...(await deskProfile()),
      localBook: !process.env.DATABASE_URL && !usesEdgeBook(),
      mailReady: mail.ready,
      mailFrom: mail.from,
      kindWords: await kindWordsOn(),
      emails: await listEmails(),
    }
  },
)

export const saveSettings = createServerFn({ method: 'POST' })
  .validator((data: { email: string; homeBase: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, ...(await saveDeskProfile(data)) }
    } catch (error) {
      return fail(error)
    }
  })

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

export const saveReview = createServerFn({ method: 'POST' })
  .validator((data: ReviewDraft) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, review: await addReview(data) }
    } catch (error) {
      return fail(error)
    }
  })

export const editReview = createServerFn({ method: 'POST' })
  .validator((data: { id: number } & ReviewDraft) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      const { id, ...draft } = data
      return { ok: true as const, review: await updateReview(id, draft) }
    } catch (error) {
      return fail(error)
    }
  })

export const showReview = createServerFn({ method: 'POST' })
  .validator((data: { id: number; show: boolean }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        review: await setReviewShown(data.id, data.show),
      }
    } catch (error) {
      return fail(error)
    }
  })

export const deleteReview = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await removeReview(data.id)
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const getCouple = createServerFn({ method: 'POST' })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => coupleBySlug(data.slug))

export const saveCouplePlanningForm = createServerFn({ method: 'POST' })
  .validator((data: { slug: string; planning: unknown }) => data)
  .handler(async ({ data }) => {
    try {
      return {
        ok: true as const,
        planning: await saveCouplePlanning(data.slug, data.planning),
      }
    } catch (error) {
      return fail(error)
    }
  })

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

export const editQuestion = createServerFn({ method: 'POST' })
  .validator((data: { id: number; prompt: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        question: await updateQuestion(data.id, data.prompt),
      }
    } catch (error) {
      return fail(error)
    }
  })

export const deleteQuestion = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await removeQuestion(data.id)
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

export const editMedia = createServerFn({ method: 'POST' })
  .validator((data: { id: number; title: string; url: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        media: await updateMedia(data.id, data.title, data.url),
      }
    } catch (error) {
      return fail(error)
    }
  })

export const deleteMedia = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await removeMedia(data.id)
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const saveLead = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      id: number
      partnerOne: string
      partnerTwo: string
      email: string
      phone: string
      eventDate: string
      packageId: string
      withStag: boolean
      stagDate: string
      message: string
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        lead: await updateLead({
          ...data,
          stagDate: data.stagDate || null,
        }),
      }
    } catch (error) {
      return fail(error)
    }
  })

export const deleteLead = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await removeLead(data.id)
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const editPartner = createServerFn({ method: 'POST' })
  .validator(
    (data: { id: number; name: string; href: string; logo: string }) => data,
  )
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, partner: await updatePartner(data) }
    } catch (error) {
      return fail(error)
    }
  })

export const editPayment = createServerFn({ method: 'POST' })
  .validator((data: { id: number; cents: number; note: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        payment: await updatePayment(data.id, data.cents, data.note),
      }
    } catch (error) {
      return fail(error)
    }
  })

export const deletePayment = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await removePayment(data.id)
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const editBot = createServerFn({ method: 'POST' })
  .validator((data: { id: number; name: string; role: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        bot: await updateBot(data.id, data.name, data.role),
      }
    } catch (error) {
      return fail(error)
    }
  })

export const deleteBot = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await removeBot(data.id)
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

import { createServerFn } from '@tanstack/react-start'
import { requireDesk } from '../auth/session.server.ts'
import { isReviewDisplay } from './google-reviews.ts'
import type { ReviewDisplay, ReviewPage } from './google-reviews.ts'
import {
  googleStatus,
  refreshGoogleReviews,
  searchGooglePlaces,
} from './google-reviews.server.ts'
import { forgetPublicSite } from './public-memory.ts'
import { drivingKm, mapsConfigured } from './travel.server.ts'
import { travelFromKm } from './travel.ts'
import { listRsvpPurchases } from '../rsvp/purchase.server.ts'
import {
  cardQuoteForInvoice,
  cardStatus,
  setCardPayments,
  startCheckout,
} from './stripe.server.ts'
import { masterFromDrafts } from '../portal/master.ts'
import type { ChoiceOption } from '../portal/questions.ts'
import { usesEdgeBook } from '../db.server.ts'
import {
  emailBooking,
  emailInvoice,
  listEmails,
  mailStatus,
} from './mail.server.ts'
import type { ReviewDraft } from './reviews.ts'
import {
  refreshTravel,
  setTravelManual,
  addMedia,
  addPayment,
  addQuestion,
  coupleBySlug,
  couplePortalForDesk,
  listCouplePortals,
  listPlanContacts,
  setCoupleEmail,
  saveCouplePasscode,
  saveCouplePlanning,
  saveDeskPlanning,
  savePortalDeskFields,
  savePortalMaster,
  bookExternalDate,
  createBooking,
  listExternalDates,
  listVenues,
  releaseExternalDate,
  removeExternalDate,
  removeBooking,
  removeVenue,
  saveVenue,
  updateVenue,
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
  readReviewDisplay,
  setReviewDisplay,
  listPlanProgress,
  setBookingNotes,
} from './store.server.ts'
import { planNudgeOverview, setPlanReminders } from '../portal/nudges.server.ts'
import { balanceNudgeOverview, setBalanceReminders } from './balance-nudges.server.ts'
import type { BalanceRow } from './balance-nudges.ts'
import type { BookingPatch } from './store.server.ts'

function fail(error: unknown) {
  return {
    ok: false as const,
    error: error instanceof Error ? error.message : 'That did not save.',
  }
}

function overviewFrom(
  bookings: Awaited<ReturnType<typeof listBookings>>,
  leads: Awaited<ReturnType<typeof listLeads>>,
  externalDates: Awaited<ReturnType<typeof listExternalDates>>,
) {
  return {
    bookings: bookings.length,
    leads: leads.length,
    totalCents: countedTotalFrom(bookings),
    upcoming: bookings.filter(
      (booking) =>
        !booking.sample &&
        (booking.status === 'hold' || booking.status === 'booked'),
    ),
    external: externalDates.filter((row) => !row.released),
  }
}

function countedTotalFrom(
  bookings: Awaited<ReturnType<typeof listBookings>>,
): number {
  return bookings.reduce((sum, booking) => {
    if (
      booking.sample ||
      booking.status === 'cancelled' ||
      booking.status === 'released'
    ) {
      return sum
    }
    return sum + booking.totalCents
  }, 0)
}

export const getOverview = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    const [bookings, leads, externalDates] = await Promise.all([
      listBookings(),
      listLeads(),
      listExternalDates(),
    ])
    return overviewFrom(bookings, leads, externalDates)
  },
)

/** One read for the desk frame, so opening it is a single request. */
export const getDesk = createServerFn({ method: 'GET' }).handler(async () => {
  await requireDesk()
  const [
    bookings,
    payments,
    leads,
    externalDates,
    questions,
    media,
    partners,
    reviews,
    bots,
    packages,
    venues,
  ] = await Promise.all([
    listBookings(),
    listPayments(),
    listLeads(),
    listExternalDates(),
    listQuestions(),
    listMedia(),
    listPartners(),
    listReviews(),
    listBots(),
    listPackageOffers(),
    listVenues(),
  ])
  const plans = await listPlanProgress().catch(() => [])
  return {
    overview: overviewFrom(bookings, leads, externalDates),
    plans,
    bookings,
    payments,
    leads,
    externalDates,
    questions,
    media,
    partners,
    reviews,
    bots,
    packages,
    venues,
  }
})

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

export const deleteExternal = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await removeExternalDate(data.id)
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const deleteBooking = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await removeBooking(data.id)
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const getVenues = createServerFn({ method: 'GET' }).handler(async () => {
  await requireDesk()
  return listVenues()
})

export const addVenue = createServerFn({ method: 'POST' })
  .validator((data: { name: string; street: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        venue: await saveVenue(data.name, data.street),
      }
    } catch (error) {
      return fail(error)
    }
  })

export const editVenue = createServerFn({ method: 'POST' })
  .validator((data: { id: number; name: string; street: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        venue: await updateVenue(data.id, data.name, data.street),
      }
    } catch (error) {
      return fail(error)
    }
  })

export const deleteVenue = createServerFn({ method: 'POST' })
  .validator((data: { id: number }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await removeVenue(data.id)
      return { ok: true as const }
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

export const saveNotes = createServerFn({ method: 'POST' })
  .validator((data: { id: number; notes: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      await setBookingNotes(data.id, String(data.notes ?? ''))
      return { ok: true as const }
    } catch (error) {
      return fail(error)
    }
  })

export const getInvoices = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    return listBookings()
  },
)

export const getPayments = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    const [bookings, payments, rsvp] = await Promise.all([
      listBookings(),
      listPayments(),
      listRsvpPurchases().catch(() => []),
    ])
    const reminders = await balanceNudgeOverview(bookings).catch(() => ({
      on: true,
      rows: [] as BalanceRow[],
    }))
    return { bookings, payments, rsvp, reminders }
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
      card: await cardStatus().catch(() => ({
        configured: false,
        enabled: false,
        live: false,
      })),
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

export const savePortalDesk = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      slug: string
      arrivalTime: string
      dueDate: string
      unlock: boolean
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        planning: await savePortalDeskFields(data.slug, data),
      }
    } catch (error) {
      return fail(error)
    }
  })

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
  .handler(async ({ data }) => {
    const invoice = await invoiceBySlug(data.slug)
    if (!invoice) return invoice
    // Null hides "Pay by card": Stripe off, not set up, or nothing due.
    return { ...invoice, card: await cardQuoteForInvoice(data.slug) }
  })

/** Public: opens Stripe Checkout for what this invoice owes right now. */
export const startCardPayment = createServerFn({ method: 'POST' })
  .validator((data: { slug?: unknown; amountCents?: unknown }) => ({
    slug: typeof data.slug === 'string' ? data.slug.trim().slice(0, 120) : '',
    amountCents:
      typeof data.amountCents === 'number' ? data.amountCents : undefined,
  }))
  .handler(async ({ data }) => {
    if (!data.slug) return { ok: false as const, error: 'That invoice was not found.' }
    try {
      return await startCheckout(data.slug, data.amountCents)
    } catch {
      return {
        ok: false as const,
        error: 'Card payment could not start. Please try again, or pay by e-transfer.',
      }
    }
  })

export const saveCardPayments = createServerFn({ method: 'POST' })
  .validator((data: { on?: unknown }) => ({ on: data.on === true }))
  .handler(async ({ data }) => {
    await requireDesk()
    const status = await cardStatus()
    if (data.on && !status.configured) {
      return {
        ok: false as const,
        error: 'Add STRIPE_SECRET_KEY and STRIPE_WEBHOOK_SECRET in Cloudflare first.',
      }
    }
    return { ok: true as const, card: await setCardPayments(data.on) }
  })

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
  .validator(
    (data: {
      id: number
      cents: number
      note: string
      paidOn?: string
      method?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      const result = await addPayment(
        data.id,
        data.cents,
        data.note,
        data.paidOn,
        data.method,
      )
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
  .validator(
    (data: {
      id: number
      cents: number
      note: string
      paidOn?: string
      method?: string
    }) => data,
  )
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        payment: await updatePayment(
          data.id,
          data.cents,
          data.note,
          data.paidOn,
          data.method,
        ),
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

type MasterDraftInput = {
  id: string
  label: string
  helper: string
  rail: string
  djNote: string
  hidden: boolean
  chips: string
  options: ChoiceOption[]
  replies: { value: string; text: string }[]
}

export const getPortalDesk = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    const [portals, nudges, contacts] = await Promise.all([
      listCouplePortals(),
      planNudgeOverview().catch(() => ({ on: true, lastRun: null, rows: [] })),
      listPlanContacts(),
    ])
    const emails = Object.fromEntries(contacts.map((item) => [item.slug, item.email]))
    return { ...portals, nudges, emails }
  },
)

export const saveBalanceRemindersDesk = createServerFn({ method: 'POST' })
  .validator((data: { on?: unknown }) => ({ on: data.on === true }))
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, on: await setBalanceReminders(data.on) }
    } catch (error) {
      return fail(error)
    }
  })

export const savePlanRemindersDesk = createServerFn({ method: 'POST' })
  .validator((data: { on?: unknown }) => ({ on: data.on === true }))
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, on: await setPlanReminders(data.on) }
    } catch (error) {
      return fail(error)
    }
  })

export const saveCoupleEmailDesk = createServerFn({ method: 'POST' })
  .validator((data: { slug?: unknown; email?: unknown }) => ({
    slug: typeof data.slug === 'string' ? data.slug : '',
    email: typeof data.email === 'string' ? data.email : '',
  }))
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, email: await setCoupleEmail(data.slug, data.email) }
    } catch (error) {
      return fail(error)
    }
  })

export const savePortalMasterDesk = createServerFn({ method: 'POST' })
  .validator((data: { drafts: MasterDraftInput[] }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      const master = await savePortalMaster(masterFromDrafts(data.drafts))
      return { ok: true as const, master }
    } catch (error) {
      return fail(error)
    }
  })

export const saveCouplePasscodeDesk = createServerFn({ method: 'POST' })
  .validator((data: { slug: string; passcode: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        passcode: await saveCouplePasscode(data.slug, data.passcode),
      }
    } catch (error) {
      return fail(error)
    }
  })

export const getCouplePortalDesk = createServerFn({ method: 'POST' })
  .validator((data: { slug: string }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    return couplePortalForDesk(data.slug)
  })

export const saveDeskPlan = createServerFn({ method: 'POST' })
  .validator((data: { slug: string; planning: unknown }) => data)
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        planning: await saveDeskPlanning(data.slug, data.planning),
      }
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

// --- Google reviews --------------------------------------------------------

/** The desk's Google reviews panel: what the site shows, and where. */
export const getGoogleReviewSettings = createServerFn({ method: 'GET' }).handler(
  async () => {
    await requireDesk()
    const [status, display] = await Promise.all([
      googleStatus().catch((error: unknown) => ({
        configured: false,
        ok: false,
        error: error instanceof Error ? error.message : 'Google could not be checked.',
        rating: 0,
        count: 0,
        shown: 0,
        fetchedAt: '',
        mapsUri: '',
      })),
      readReviewDisplay(),
    ])
    return { status, display }
  },
)

export const saveReviewDisplay = createServerFn({ method: 'POST' })
  .validator((data: { page?: string; mode?: string }) => ({
    page: (data.page === 'weddings' ? 'weddings' : 'home') as ReviewPage,
    mode: isReviewDisplay(data.mode) ? data.mode : ('both' as ReviewDisplay),
  }))
  .handler(async ({ data }) => {
    await requireDesk()
    const display = await setReviewDisplay(data.page, data.mode)
    await forgetPublicSite()
    return { ok: true as const, display }
  })

export const refreshGoogle = createServerFn({ method: 'POST' }).handler(
  async () => {
    await requireDesk()
    return refreshGoogleReviews()
  },
)

export const findGooglePlace = createServerFn({ method: 'POST' })
  .validator((data: { query?: string }) => ({
    query: typeof data.query === 'string' ? data.query.trim().slice(0, 200) : '',
  }))
  .handler(async ({ data }) => {
    await requireDesk()
    if (!data.query) return { ok: false as const, error: 'Type the business name and town.' }
    return searchGooglePlaces(data.query)
  })

// --- travel ----------------------------------------------------------------

/** Recalculate: ask Google again for the driving distance, even if paid. */
export const recalcTravel = createServerFn({ method: 'POST' })
  .validator((data: { id?: unknown }) => ({ id: Number(data.id) }))
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return { ok: true as const, booking: await refreshTravel(data.id, { force: true }) }
    } catch (error) {
      return fail(error)
    }
  })

/** The owner's own distance and/or fee; both blank goes back to automatic. */
export const saveTravel = createServerFn({ method: 'POST' })
  .validator((data: { id?: unknown; km?: unknown; fee?: unknown }) => {
    const number = (value: unknown) => {
      if (value === null || value === undefined) return null
      const text = String(value).replace(/[$,\s]/g, '')
      if (text === '') return null
      const parsed = Number(text)
      return Number.isFinite(parsed) ? parsed : Number.NaN
    }
    const fee = number(data.fee)
    return {
      id: Number(data.id),
      km: number(data.km),
      feeCents: fee == null ? null : Number.isNaN(fee) ? Number.NaN : Math.round(fee * 100),
    }
  })
  .handler(async ({ data }) => {
    await requireDesk()
    try {
      return {
        ok: true as const,
        booking: await setTravelManual(data.id, { km: data.km, feeCents: data.feeCents }),
      }
    } catch (error) {
      return fail(error)
    }
  })

/** Desk: the driving distance and fee for any address. Changes nothing. */
export const checkDistance = createServerFn({ method: 'POST' })
  .validator((data: { address?: unknown; packageId?: unknown }) => ({
    address: typeof data.address === 'string' ? data.address.trim().slice(0, 200) : '',
    packageId: typeof data.packageId === 'string' ? data.packageId : 'full',
  }))
  .handler(async ({ data }) => {
    await requireDesk()
    if (!mapsConfigured()) {
      return { ok: false as const, error: 'ORS_API_KEY is not set in Cloudflare.' }
    }
    const found = await drivingKm(data.address)
    if (!found.ok) return { ok: false as const, error: `${found.reason}: ${found.detail}` }
    const figure = travelFromKm(found.km, data.packageId)
    return {
      ok: true as const,
      km: found.km,
      cached: found.cached,
      feeCents: figure.feeCents ?? 0,
      tier: figure.tier,
      hotel: figure.hotel,
    }
  })

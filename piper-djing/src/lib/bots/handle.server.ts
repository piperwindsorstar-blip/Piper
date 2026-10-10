import { emailBooking, emailInvoice, listEmails } from '../crm/mail.server.ts'
import {
  addMedia,
  addPartner,
  addPayment,
  addQuestion,
  addReview,
  botFromToken,
  createBooking,
  createInquiry,
  deskProfile,
  getTerms,
  inviteBot,
  listBots,
  listBookings,
  listLeads,
  listVenues,
  listMedia,
  listPackageOffers,
  listPartners,
  listPayments,
  listQuestions,
  listReviews,
  removeBot,
  removeBooking,
  removeExternalDate,
  removeLead,
  removeVenue,
  removeMedia,
  removePartner,
  removePayment,
  removeQuestion,
  removeReview,
  saveDeskProfile,
  saveVenue,
  sendInvoice,
  setBookingStatus,
  setReviewShown,
  updateBooking,
  updateBot,
  updateLead,
  updateMedia,
  updatePackageOffer,
  updatePartner,
  updatePayment,
  updateQuestion,
  updateReview,
  updateTerms,
  voidBookingInvoice,
} from '../crm/store.server.ts'
import type { BookingView, BotRole } from '../crm/store.server.ts'

type Bot = { id: number; name: string; role: BotRole }

function tokenFrom(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : ''
}

async function actor(request: Request): Promise<Bot | Response> {
  const bot = await botFromToken(tokenFrom(request))
  if (!bot)
    return Response.json(
      { error: 'That invite is not on the desk.' },
      { status: 401 },
    )
  return bot
}

function isBot(value: Bot | Response): value is Bot {
  return !(value instanceof Response)
}

function jsonError(error: unknown, status = 400) {
  const message = error instanceof Error ? error.message : 'That did not save.'
  return Response.json({ error: message }, { status })
}

function canWrite(role: BotRole): boolean {
  return role === 'writer' || role === 'ceo'
}

function canManage(role: BotRole): boolean {
  return role === 'ceo'
}

export async function handleBot(request: Request): Promise<Response> {
  const auth = await actor(request)
  if (!isBot(auth)) return auth

  if (request.method === 'GET') {
    const resource =
      new URL(request.url).searchParams.get('resource') ?? 'bookings'
    return readResource(resource)
  }

  if (request.method !== 'POST') {
    return Response.json({ error: 'Use GET or POST.' }, { status: 405 })
  }

  const body = (await request.json().catch(() => null)) as Record<
    string,
    unknown
  > | null
  if (!body || typeof body.action !== 'string') {
    return Response.json({ error: 'Send an action.' }, { status: 400 })
  }
  if (!canWrite(auth.role)) {
    return Response.json({ error: 'This bot can read.' }, { status: 403 })
  }
  try {
    return await writeAction(auth.role, body)
  } catch (error) {
    return jsonError(error)
  }
}

async function readResource(resource: string): Promise<Response> {
  switch (resource) {
    case 'bookings':
      return Response.json({ bookings: await listBookings() })
    case 'invoices':
      return Response.json({
        invoices: (await listBookings())
          .map(
            (booking) =>
              booking.invoice && {
                bookingId: booking.id,
                names: names(booking),
                ...booking.invoice,
              },
          )
          .filter(Boolean),
      })
    case 'payments':
      return Response.json({ payments: await listPayments() })
    case 'leads':
      return Response.json({ leads: await listLeads() })
    case 'packages':
      return Response.json({ packages: await listPackageOffers() })
    case 'partners':
      return Response.json({ partners: await listPartners() })
    case 'reviews':
      return Response.json({ reviews: await listReviews() })
    case 'settings':
      return Response.json({ settings: await deskProfile() })
    case 'terms':
      return Response.json({ terms: await getTerms() })
    case 'questions':
      return Response.json({ questions: await listQuestions() })
    case 'media':
      return Response.json({ media: await listMedia() })
    case 'bots':
      return Response.json({ bots: await listBots() })
    case 'emails':
      return Response.json({ emails: await listEmails() })
    case 'venues':
      return Response.json({ venues: await listVenues() })
    default:
      return Response.json(
        { error: 'That resource is not on the desk.' },
        { status: 404 },
      )
  }
}

function names(booking: BookingView): string {
  return `${booking.partnerOne} and ${booking.partnerTwo}`
}

function str(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value : ''
}

function num(body: Record<string, unknown>, key: string): number {
  const value = body[key]
  return typeof value === 'number' ? value : Number(value)
}

function bool(body: Record<string, unknown>, key: string): boolean {
  return body[key] === true
}

function idOf(body: Record<string, unknown>): number {
  const id = num(body, 'bookingId')
  if (!Number.isInteger(id)) throw new Error('Send a booking id.')
  return id
}

async function writeAction(
  role: BotRole,
  body: Record<string, unknown>,
): Promise<Response> {
  switch (body.action) {
    case 'create_lead': {
      const result = await createInquiry({
        partnerOne: str(body, 'partnerOne'),
        partnerTwo: str(body, 'partnerTwo'),
        email: str(body, 'email'),
        phone: str(body, 'phone'),
        eventDate: str(body, 'eventDate'),
        packageId: str(body, 'packageId'),
        withStag: bool(body, 'withStag'),
        stagDate: str(body, 'stagDate') || null,
        message: str(body, 'message'),
      })
      if (!result.ok)
        return Response.json({ error: result.error }, { status: 400 })
      return Response.json(result)
    }
    case 'create_booking':
      return Response.json({
        booking: await createBooking({
          partnerOne: str(body, 'partnerOne'),
          partnerTwo: str(body, 'partnerTwo'),
          email: str(body, 'email'),
          phone: str(body, 'phone'),
          eventDate: str(body, 'eventDate'),
          stagDate: str(body, 'stagDate') || null,
          packageId: str(body, 'packageId'),
          withStag: bool(body, 'withStag'),
          uplights: Number.isInteger(body.uplights)
            ? (body.uplights as number)
            : 0,
          venueKm: Array.isArray(body.venueKm)
            ? (body.venueKm as number[])
            : [],
          venueName: str(body, 'venueName'),
          venueStreet: str(body, 'venueStreet'),
          venueTwoName: str(body, 'venueTwoName'),
          venueTwoStreet: str(body, 'venueTwoStreet'),
          sample: bool(body, 'sample'),
          notes: str(body, 'notes'),
        }),
      })
    case 'update_booking': {
      const current = (await listBookings()).find(
        (booking) => booking.id === idOf(body),
      )
      if (!current) throw new Error('That booking is not on the book.')
      return Response.json({
        booking: await updateBooking({
          id: current.id,
          partnerOne: str(body, 'partnerOne') || current.partnerOne,
          partnerTwo: str(body, 'partnerTwo') || current.partnerTwo,
          email: body.email === undefined ? current.email : str(body, 'email'),
          phone: body.phone === undefined ? current.phone : str(body, 'phone'),
          eventDate: str(body, 'eventDate') || current.eventDate,
          stagDate:
            body.stagDate === undefined
              ? current.stagDate
              : str(body, 'stagDate') || null,
          packageId: str(body, 'packageId') || current.packageId,
          withStag:
            body.withStag === undefined
              ? current.withStag
              : bool(body, 'withStag'),
          uplights:
            body.uplights === undefined
              ? current.uplights
              : num(body, 'uplights'),
          venueKm: Array.isArray(body.venueKm)
            ? (body.venueKm as number[])
            : current.venueKm,
          venueName:
            body.venueName === undefined
              ? current.venueName
              : str(body, 'venueName'),
          venueStreet:
            body.venueStreet === undefined
              ? current.venueStreet
              : str(body, 'venueStreet'),
          venueTwoName:
            body.venueTwoName === undefined
              ? current.venueTwoName
              : str(body, 'venueTwoName'),
          venueTwoStreet:
            body.venueTwoStreet === undefined
              ? current.venueTwoStreet
              : str(body, 'venueTwoStreet'),
          sample:
            body.sample === undefined ? current.sample : bool(body, 'sample'),
          notes: body.notes === undefined ? current.notes : str(body, 'notes'),
        }),
      })
    }
    case 'send_invoice':
      return Response.json(await sendInvoice(idOf(body)))
    case 'void_invoice':
      return Response.json({ booking: await voidBookingInvoice(idOf(body)) })
    case 'record_payment':
      return Response.json(
        await addPayment(idOf(body), num(body, 'cents'), str(body, 'note')),
      )
    case 'release':
      return Response.json({
        booking: await setBookingStatus(idOf(body), 'release'),
      })
    case 'cancel':
      return Response.json({
        booking: await setBookingStatus(idOf(body), 'cancel'),
      })
    case 'release_stag':
      return Response.json({
        booking: await setBookingStatus(idOf(body), 'release-stag'),
      })
    case 'delete_booking':
      await removeBooking(idOf(body))
      return Response.json({ ok: true })
    case 'delete_external':
      await removeExternalDate(num(body, 'id'))
      return Response.json({ ok: true })
    case 'save_venue':
      return Response.json({
        venue: await saveVenue(str(body, 'name'), str(body, 'street')),
      })
    case 'delete_venue':
      await removeVenue(num(body, 'id'))
      return Response.json({ venues: await listVenues() })
    case 'update_terms':
      return Response.json({ terms: await updateTerms(str(body, 'body')) })
    case 'add_question':
      await addQuestion(str(body, 'prompt'))
      return Response.json({ questions: await listQuestions() })
    case 'add_media':
      await addMedia(str(body, 'title'), str(body, 'url'))
      return Response.json({ media: await listMedia() })
    case 'update_question':
      return Response.json({
        question: await updateQuestion(num(body, 'id'), str(body, 'prompt')),
      })
    case 'delete_question':
      await removeQuestion(num(body, 'id'))
      return Response.json({ questions: await listQuestions() })
    case 'update_media':
      return Response.json({
        media: await updateMedia(
          num(body, 'id'),
          str(body, 'title'),
          str(body, 'url'),
        ),
      })
    case 'delete_media':
      await removeMedia(num(body, 'id'))
      return Response.json({ media: await listMedia() })
    case 'update_lead':
      return Response.json({
        lead: await updateLead({
          id: num(body, 'id'),
          partnerOne: str(body, 'partnerOne'),
          partnerTwo: str(body, 'partnerTwo'),
          email: str(body, 'email'),
          phone: str(body, 'phone'),
          eventDate: str(body, 'eventDate'),
          packageId: str(body, 'packageId'),
          withStag: bool(body, 'withStag'),
          stagDate: str(body, 'stagDate') || null,
          message: str(body, 'message'),
        }),
      })
    case 'delete_lead':
      await removeLead(num(body, 'id'))
      return Response.json({ leads: await listLeads() })
    case 'update_package':
      return Response.json({
        package: await updatePackageOffer({
          id: str(body, 'id'),
          name: str(body, 'name'),
          detail: str(body, 'detail'),
          cents: num(body, 'cents'),
        }),
      })
    case 'add_partner':
      return Response.json({
        partner: await addPartner({
          name: str(body, 'name'),
          href: str(body, 'href'),
          logo: str(body, 'logo'),
        }),
      })
    case 'update_partner':
      return Response.json({
        partner: await updatePartner({
          id: num(body, 'id'),
          name: str(body, 'name'),
          href: str(body, 'href'),
          logo: str(body, 'logo'),
        }),
      })
    case 'delete_partner':
      await removePartner(num(body, 'id'))
      return Response.json({ partners: await listPartners() })
    case 'add_review':
      return Response.json({
        review: await addReview({
          quote: str(body, 'quote'),
          names: str(body, 'names'),
          eventType: str(body, 'eventType'),
          town: str(body, 'town'),
          date: str(body, 'date'),
          source: str(body, 'source'),
          show: bool(body, 'show'),
        }),
      })
    case 'update_review':
      return Response.json({
        review: await updateReview(num(body, 'id'), {
          quote: str(body, 'quote'),
          names: str(body, 'names'),
          eventType: str(body, 'eventType'),
          town: str(body, 'town'),
          date: str(body, 'date'),
          source: str(body, 'source'),
          show: bool(body, 'show'),
        }),
      })
    case 'show_review':
      return Response.json({
        review: await setReviewShown(num(body, 'id'), bool(body, 'show')),
      })
    case 'delete_review':
      await removeReview(num(body, 'id'))
      return Response.json({ reviews: await listReviews() })
    case 'update_payment':
      return Response.json({
        payment: await updatePayment(
          num(body, 'id'),
          num(body, 'cents'),
          str(body, 'note'),
        ),
      })
    case 'delete_payment':
      await removePayment(num(body, 'id'))
      return Response.json({ payments: await listPayments() })
    case 'update_settings':
      if (!canManage(role)) {
        return Response.json(
          { error: 'The Ceo bot changes settings.' },
          { status: 403 },
        )
      }
      return Response.json({
        settings: await saveDeskProfile({
          email: str(body, 'email'),
          homeBase: str(body, 'homeBase'),
        }),
      })
    case 'update_bot':
      if (!canManage(role)) {
        return Response.json(
          { error: 'The Ceo bot changes invites.' },
          { status: 403 },
        )
      }
      return Response.json({
        bot: await updateBot(
          num(body, 'id'),
          str(body, 'name'),
          str(body, 'role'),
        ),
      })
    case 'delete_bot':
      if (!canManage(role)) {
        return Response.json(
          { error: 'The Ceo bot changes invites.' },
          { status: 403 },
        )
      }
      await removeBot(num(body, 'id'))
      return Response.json({ bots: await listBots() })
    case 'invite_bot':
      if (!canManage(role)) {
        return Response.json(
          { error: 'The Ceo bot changes invites.' },
          { status: 403 },
        )
      }
      return Response.json(
        await inviteBot(str(body, 'name'), str(body, 'role')),
      )
    case 'email_booking':
      return Response.json(await emailBooking(idOf(body)))
    case 'email_invoice':
      return Response.json(await emailInvoice(idOf(body)))
    default:
      return Response.json(
        { error: 'That action is not on the desk.' },
        { status: 400 },
      )
  }
}

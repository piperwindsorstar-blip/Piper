import { createHash } from 'node:crypto'
import { query } from '../db.server.ts'
import { listEmails } from '../crm/mail.server.ts'
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
  listMedia,
  listPackageOffers,
  listPartners,
  listPayments,
  listQuestions,
  listReviews,
  removeBot,
  removeLead,
  removeMedia,
  removePartner,
  removePayment,
  removeQuestion,
  removeReview,
  saveDeskProfile,
  sendInvoice,
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
import type { BookingView, BotRole, LeadView } from '../crm/store.server.ts'
import type { ReviewDraft } from '../crm/reviews.ts'
import { isPackageId } from '../crm/defaults.ts'
import { dollarsToCents } from '../crm/money.ts'
import { legacyRole } from './desk-leads.server.ts'
import { selectLeads, toBotLead } from './desk-leads.ts'
import { deskBotTarget } from './desk-rest.ts'
import type { DeskBotTarget } from './desk-rest.ts'

const DENIED = 'Send Authorization: Bearer and the token from join.'

type Verdict = 'yes' | 'no' | 'unknown' | BotRole

const HEADERS = {
  'cache-control': 'no-store',
  'x-piper-book': 'desk',
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, content-type, idempotency-key',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

export async function deskBotResponse(
  request: Request,
  checkLegacy: (token: string) => Promise<Verdict> = legacyRole,
): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HEADERS })
  }
  const target = deskBotTarget(new URL(request.url).pathname)
  if (!target) {
    return botJson({ error: 'That resource is not on the desk.' }, 404)
  }
  const token = bearer(request)
  if (!token) return botJson({ error: DENIED }, 401)
  const role = await actorRole(token, checkLegacy)
  if (role instanceof Response) return role
  const key = request.headers.get('idempotency-key')?.trim() ?? ''
  const writing = request.method !== 'GET' && request.method !== 'HEAD'
  if (writing && key) {
    const saved = await remembered(token, key)
    if (saved) return saved
  }
  const response = await dispatch(request, target, role)
  if (writing && key && response.status < 500) {
    await remember(token, key, response)
  }
  return response
}

async function actorRole(
  token: string,
  checkLegacy: (token: string) => Promise<Verdict>,
): Promise<BotRole | Response> {
  const local = await botFromToken(token)
  if (local) return local.role
  const verdict = await checkLegacy(token)
  if (verdict === 'no') return botJson({ error: DENIED }, 401)
  if (verdict === 'unknown') {
    return botJson({ error: 'The bot could not be checked.' }, 503)
  }
  if (verdict === 'yes') return 'writer'
  return verdict
}

function canWrite(role: BotRole): boolean {
  return role === 'writer' || role === 'ceo'
}

function canManage(role: BotRole): boolean {
  return role === 'ceo'
}

async function dispatch(
  request: Request,
  target: DeskBotTarget,
  role: BotRole,
): Promise<Response> {
  const method = request.method
  if (
    method !== 'GET' &&
    method !== 'POST' &&
    method !== 'PUT' &&
    method !== 'PATCH' &&
    method !== 'DELETE'
  ) {
    return botJson({ error: 'Use GET, POST, PUT, PATCH, or DELETE.' }, 405)
  }
  if (method !== 'GET' && !canWrite(role)) {
    return botJson({ error: 'This bot can read.' }, 403)
  }
  const body =
    method === 'GET' || method === 'DELETE' ? {} : await readBody(request)
  try {
    return await route(
      method,
      target,
      role,
      body,
      new URL(request.url).searchParams,
    )
  } catch (error) {
    const message =
      error instanceof Error ? error.message : 'That did not save.'
    return botJson({ error: message }, 400)
  }
}

async function route(
  method: string,
  target: DeskBotTarget,
  role: BotRole,
  body: Record<string, unknown>,
  search: URLSearchParams,
): Promise<Response> {
  switch (target.resource) {
    case 'leads':
      return leadResource(method, target.id, body, search)
    case 'bookings':
      return bookingResource(method, target.id, body, search)
    case 'invoices':
      return invoices(method, target.id, body)
    case 'payments':
      return payments(method, target.id, body)
    case 'packages':
      return packages(method, target.id, body)
    case 'terms':
      return terms(method, body)
    case 'questions':
      return questions(method, target.id, body)
    case 'media':
      return media(method, target.id, body)
    case 'partners':
      return partners(method, target.id, body)
    case 'reviews':
      return reviews(method, target.id, body)
    case 'bots':
      return bots(method, target.id, body, role)
    case 'emails':
      if (method !== 'GET') {
        return botJson({ error: 'Emails are a record of what was sent.' }, 405)
      }
      return botJson({ emails: await listEmails() })
    case 'settings':
      return settings(method, body, role)
    default:
      return botJson({ error: 'That resource is not on the desk.' }, 404)
  }
}

async function leadResource(
  method: string,
  id: string | null,
  body: Record<string, unknown>,
  search: URLSearchParams,
): Promise<Response> {
  if (method === 'GET' && !id) {
    const leads = selectLeads(
      (await listLeads()).map((lead) => toBotLead(lead)),
      search,
    )
    return botJson({ leads })
  }
  if (method === 'GET') {
    const lead = (await listLeads()).find((item) => item.id === intId(id))
    if (!lead)
      return botJson({ error: 'That inquiry is not on the desk.' }, 404)
    return botJson({ lead: toBotLead(lead) })
  }
  if (method === 'POST' && !id) {
    const draft = leadDraft(body, null)
    const result = await createInquiry({
      ...draft,
      stagDate: draft.stagDate,
    })
    if (!result.ok) return botJson({ error: result.error }, 400)
    const saved = (await listLeads()).find(
      (lead) =>
        lead.email === draft.email &&
        lead.partnerOne === draft.partnerOne &&
        lead.partnerTwo === draft.partnerTwo,
    )
    return botJson({
      unavailable: result.unavailable,
      lead: saved ? toBotLead(saved) : null,
    })
  }
  if ((method === 'PATCH' || method === 'PUT') && id) {
    const current = (await listLeads()).find((item) => item.id === intId(id))
    if (!current)
      return botJson({ error: 'That inquiry is not on the desk.' }, 404)
    return botJson({
      lead: toBotLead(await updateLead(leadDraft(body, current))),
    })
  }
  if (method === 'DELETE' && id) {
    await removeLead(intId(id))
    return botJson({ ok: true })
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

async function bookingResource(
  method: string,
  id: string | null,
  body: Record<string, unknown>,
  search: URLSearchParams,
): Promise<Response> {
  if (method === 'GET' && !id) {
    const date = search.get('date')?.trim() ?? ''
    const q = search.get('q')?.trim().toLowerCase() ?? ''
    const bookings = (await listBookings())
      .filter((booking) => {
        if (date && booking.eventDate !== date && booking.stagDate !== date)
          return false
        if (!q) return true
        return [
          booking.partnerOne,
          booking.partnerTwo,
          booking.email,
          booking.notes,
          booking.packageName,
        ]
          .join('\n')
          .toLowerCase()
          .includes(q)
      })
      .map(botBooking)
    return botJson({ bookings })
  }
  if (method === 'GET') {
    const booking = (await listBookings()).find((item) => item.id === intId(id))
    if (!booking)
      return botJson({ error: 'That booking is not on the book.' }, 404)
    return botJson({ booking: botBooking(booking) })
  }
  if (method === 'POST' && !id) {
    const [one, two] = coupleNames(str(body, 'couple') || str(body, 'name'))
    return botJson({
      booking: botBooking(
        await createBooking({
          partnerOne: str(body, 'partnerOne') || one,
          partnerTwo: str(body, 'partnerTwo') || two,
          email: str(body, 'email'),
          phone: str(body, 'phone'),
          eventDate: str(body, 'eventDate') || str(body, 'weddingDate'),
          stagDate: str(body, 'stagDate') || null,
          packageId: str(body, 'packageId') || str(body, 'service') || 'full',
          withStag: bool(body, 'withStag'),
          uplights: integer(body.uplights, 0),
          venueKm: Array.isArray(body.venueKm)
            ? (body.venueKm as number[])
            : [],
          venueName: str(body, 'venueName') || str(body, 'venue'),
          venueStreet: str(body, 'venueStreet') || str(body, 'streetAddress'),
          venueTwoName: str(body, 'venueTwoName'),
          venueTwoStreet: str(body, 'venueTwoStreet'),
          sample: body.sample === true || body.test === true,
          notes: str(body, 'notes'),
        }),
      ),
    })
  }
  if ((method === 'PATCH' || method === 'PUT') && id) {
    const current = (await listBookings()).find((item) => item.id === intId(id))
    if (!current)
      return botJson({ error: 'That booking is not on the book.' }, 404)
    const [one, two] = coupleNames(str(body, 'couple') || str(body, 'name'))
    return botJson({
      booking: botBooking(
        await updateBooking({
          id: current.id,
          partnerOne: str(body, 'partnerOne') || one || current.partnerOne,
          partnerTwo: str(body, 'partnerTwo') || two || current.partnerTwo,
          email: body.email === undefined ? current.email : str(body, 'email'),
          phone: body.phone === undefined ? current.phone : str(body, 'phone'),
          eventDate:
            str(body, 'eventDate') ||
            str(body, 'weddingDate') ||
            current.eventDate,
          stagDate:
            body.stagDate === undefined
              ? current.stagDate
              : str(body, 'stagDate') || null,
          packageId:
            str(body, 'packageId') || str(body, 'service') || current.packageId,
          withStag:
            body.withStag === undefined
              ? current.withStag
              : bool(body, 'withStag'),
          uplights:
            body.uplights === undefined
              ? current.uplights
              : integer(body.uplights, 0),
          venueKm: Array.isArray(body.venueKm)
            ? (body.venueKm as number[])
            : current.venueKm,
          venueName:
            body.venueName === undefined && body.venue === undefined
              ? current.venueName
              : str(body, 'venueName') || str(body, 'venue'),
          venueStreet:
            body.venueStreet === undefined && body.streetAddress === undefined
              ? current.venueStreet
              : str(body, 'venueStreet') || str(body, 'streetAddress'),
          venueTwoName:
            body.venueTwoName === undefined
              ? current.venueTwoName
              : str(body, 'venueTwoName'),
          venueTwoStreet:
            body.venueTwoStreet === undefined
              ? current.venueTwoStreet
              : str(body, 'venueTwoStreet'),
          sample:
            body.sample === undefined && body.test === undefined
              ? current.sample
              : body.sample === true || body.test === true,
          notes: body.notes === undefined ? current.notes : str(body, 'notes'),
        }),
      ),
    })
  }
  if (method === 'DELETE') {
    return botJson({ error: 'Cancel instead of delete.' }, 400)
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

async function invoices(
  method: string,
  id: string | null,
  body: Record<string, unknown>,
): Promise<Response> {
  const rows = async () =>
    (await listBookings())
      .filter((booking) => booking.invoice)
      .map((booking) => ({
        id: booking.invoice?.id,
        bookingId: booking.id,
        names: `${booking.partnerOne} and ${booking.partnerTwo}`,
        ...booking.invoice,
      }))
  if (method === 'GET' && !id) return botJson({ invoices: await rows() })
  if (method === 'GET') {
    const invoice = (await rows()).find(
      (item) => item.id === intId(id) || item.bookingId === intId(id),
    )
    if (!invoice) return botJson({ error: 'That booking has no invoice.' }, 404)
    return botJson({ invoice })
  }
  if ((method === 'PATCH' || method === 'PUT') && id) {
    const invoice = (await rows()).find(
      (item) => item.id === intId(id) || item.bookingId === intId(id),
    )
    if (!invoice) return botJson({ error: 'That booking has no invoice.' }, 404)
    const status = str(body, 'status')
    if (status === 'void') {
      return botJson({
        booking: botBooking(await voidBookingInvoice(invoice.bookingId)),
      })
    }
    if (status === 'sent') {
      return botJson(await sendInvoice(invoice.bookingId))
    }
    return botJson({ error: 'Send status sent or void.' }, 400)
  }
  return botJson({ error: 'An invoice is part of the booking.' }, 405)
}

async function payments(
  method: string,
  id: string | null,
  body: Record<string, unknown>,
): Promise<Response> {
  if (method === 'GET' && !id)
    return botJson({ payments: await listPayments() })
  if (method === 'GET') {
    const payment = (await listPayments()).find((item) => item.id === intId(id))
    if (!payment)
      return botJson({ error: 'That payment is not on the book.' }, 404)
    return botJson({ payment })
  }
  if (method === 'POST' && !id) {
    return botJson(
      await addPayment(
        intId(String(body.bookingId ?? '')),
        money(body),
        str(body, 'note'),
      ),
    )
  }
  if ((method === 'PATCH' || method === 'PUT') && id) {
    return botJson({
      payment: await updatePayment(intId(id), money(body), str(body, 'note')),
    })
  }
  if (method === 'DELETE' && id) {
    await removePayment(intId(id))
    return botJson({ ok: true })
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

async function packages(
  method: string,
  id: string | null,
  body: Record<string, unknown>,
): Promise<Response> {
  if (method === 'GET' && !id)
    return botJson({ packages: await listPackageOffers() })
  if (method === 'GET') {
    const item = (await listPackageOffers()).find((offer) => offer.id === id)
    if (!item) return botJson({ error: 'Choose a package.' }, 404)
    return botJson({ package: item })
  }
  if (method === 'DELETE') {
    return botJson({ error: 'These four packages stay.' }, 400)
  }
  if (method === 'POST' || method === 'PATCH' || method === 'PUT') {
    const current = (await listPackageOffers()).find(
      (offer) => offer.id === (id || str(body, 'id')),
    )
    if (!current) return botJson({ error: 'Choose a package.' }, 404)
    const detail =
      str(body, 'detail') ||
      str(body, 'includes') ||
      str(body, 'blurb') ||
      current.detail
    return botJson({
      package: await updatePackageOffer({
        id: current.id,
        name: str(body, 'name') || current.name,
        detail,
        cents:
          body.cents === undefined && body.priceCents === undefined
            ? current.cents
            : money(body),
      }),
    })
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

async function terms(
  method: string,
  body: Record<string, unknown>,
): Promise<Response> {
  if (method === 'GET') return botJson({ terms: await getTerms() })
  if (method === 'DELETE') {
    return botJson({ error: 'The terms document stays.' }, 400)
  }
  if (method === 'PATCH' || method === 'PUT' || method === 'POST') {
    return botJson({ terms: await updateTerms(str(body, 'body')) })
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

async function questions(
  method: string,
  id: string | null,
  body: Record<string, unknown>,
): Promise<Response> {
  if (method === 'GET' && !id)
    return botJson({ questions: await listQuestions() })
  if (method === 'POST' && !id) {
    await addQuestion(str(body, 'prompt') || str(body, 'question'))
    return botJson({ questions: await listQuestions() })
  }
  if ((method === 'PATCH' || method === 'PUT') && id) {
    return botJson({
      question: await updateQuestion(
        intId(id),
        str(body, 'prompt') || str(body, 'question'),
      ),
    })
  }
  if (method === 'DELETE' && id) {
    await removeQuestion(intId(id))
    return botJson({ questions: await listQuestions() })
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

async function media(
  method: string,
  id: string | null,
  body: Record<string, unknown>,
): Promise<Response> {
  if (method === 'GET' && !id) return botJson({ media: await listMedia() })
  if (method === 'POST' && !id) {
    await addMedia(str(body, 'title'), str(body, 'url'))
    return botJson({ media: await listMedia() })
  }
  if ((method === 'PATCH' || method === 'PUT') && id) {
    const current = (await listMedia()).find((item) => item.id === intId(id))
    if (!current)
      return botJson({ error: 'That link is not on the desk.' }, 404)
    return botJson({
      media: await updateMedia(
        current.id,
        str(body, 'title') || current.title,
        str(body, 'url') || current.url,
      ),
    })
  }
  if (method === 'DELETE' && id) {
    await removeMedia(intId(id))
    return botJson({ media: await listMedia() })
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

async function partners(
  method: string,
  id: string | null,
  body: Record<string, unknown>,
): Promise<Response> {
  if (method === 'GET' && !id)
    return botJson({ partners: await listPartners() })
  if (method === 'POST' && !id) {
    return botJson({
      partner: await addPartner({
        name: str(body, 'name'),
        href: str(body, 'href') || str(body, 'website'),
        logo: str(body, 'logo'),
      }),
    })
  }
  if ((method === 'PATCH' || method === 'PUT') && id) {
    const current = (await listPartners()).find((item) => item.id === intId(id))
    if (!current)
      return botJson({ error: 'That brand is not on the page.' }, 404)
    return botJson({
      partner: await updatePartner({
        id: current.id,
        name: str(body, 'name') || current.name,
        href: str(body, 'href') || str(body, 'website') || current.href,
        logo: str(body, 'logo'),
      }),
    })
  }
  if (method === 'DELETE' && id) {
    await removePartner(intId(id))
    return botJson({ partners: await listPartners() })
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

async function reviews(
  method: string,
  id: string | null,
  body: Record<string, unknown>,
): Promise<Response> {
  if (method === 'GET' && !id) return botJson({ reviews: await listReviews() })
  if (method === 'POST' && !id) {
    return botJson({ review: await addReview(reviewDraft(body, null)) })
  }
  if ((method === 'PATCH' || method === 'PUT') && id) {
    const current = (await listReviews()).find((item) => item.id === intId(id))
    if (!current)
      return botJson({ error: 'That review is not on the page.' }, 404)
    if (Object.keys(body).length === 1 && typeof body.show === 'boolean') {
      return botJson({ review: await setReviewShown(current.id, body.show) })
    }
    return botJson({
      review: await updateReview(current.id, reviewDraft(body, current)),
    })
  }
  if (method === 'DELETE' && id) {
    await removeReview(intId(id))
    return botJson({ reviews: await listReviews() })
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

async function bots(
  method: string,
  id: string | null,
  body: Record<string, unknown>,
  role: BotRole,
): Promise<Response> {
  if (method === 'GET' && !id) return botJson({ bots: await listBots() })
  if (method !== 'GET' && !canManage(role)) {
    return botJson({ error: 'The Ceo bot changes invites.' }, 403)
  }
  if (method === 'POST' && !id) {
    return botJson(await inviteBot(str(body, 'name'), str(body, 'role')))
  }
  if ((method === 'PATCH' || method === 'PUT') && id) {
    const current = (await listBots()).find((item) => item.id === intId(id))
    if (!current) return botJson({ error: 'That bot is not on the desk.' }, 404)
    return botJson({
      bot: await updateBot(
        current.id,
        str(body, 'name') || current.name,
        str(body, 'role') || current.role,
      ),
    })
  }
  if (method === 'DELETE' && id) {
    await removeBot(intId(id))
    return botJson({ bots: await listBots() })
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

async function settings(
  method: string,
  body: Record<string, unknown>,
  role: BotRole,
): Promise<Response> {
  if (method === 'GET') return botJson({ settings: await deskProfile() })
  if (!canManage(role)) {
    return botJson({ error: 'The Ceo bot changes settings.' }, 403)
  }
  if (method === 'PATCH' || method === 'PUT' || method === 'POST') {
    const current = await deskProfile()
    return botJson({
      settings: await saveDeskProfile({
        email: str(body, 'email') || current.email,
        homeBase: str(body, 'homeBase') || current.homeBase,
      }),
    })
  }
  return botJson({ error: 'That action is not on the desk.' }, 405)
}

function leadDraft(body: Record<string, unknown>, current: LeadView | null) {
  const [one, two] = coupleNames(str(body, 'name') || str(body, 'couple'))
  const withStag =
    body.withStag === undefined
      ? (current?.withStag ?? false)
      : bool(body, 'withStag')
  const packageId =
    str(body, 'packageId') ||
    str(body, 'service') ||
    current?.packageId ||
    'full'
  return {
    id: current?.id ?? 0,
    partnerOne: str(body, 'partnerOne') || one || current?.partnerOne || '',
    partnerTwo: str(body, 'partnerTwo') || two || current?.partnerTwo || '',
    email:
      body.email === undefined ? (current?.email ?? '') : str(body, 'email'),
    phone:
      body.phone === undefined ? (current?.phone ?? '') : str(body, 'phone'),
    eventDate:
      str(body, 'eventDate') ||
      str(body, 'weddingDate') ||
      current?.eventDate ||
      '',
    packageId: isPackageId(packageId)
      ? packageId
      : current?.packageId || 'full',
    withStag,
    stagDate: withStag
      ? body.stagDate === undefined
        ? (current?.stagDate ?? null)
        : str(body, 'stagDate') || null
      : null,
    message:
      body.message === undefined && body.notes === undefined
        ? (current?.message ?? '')
        : str(body, 'message') || str(body, 'notes'),
  }
}

function reviewDraft(
  body: Record<string, unknown>,
  current: ReviewDraft | null,
): ReviewDraft {
  return {
    quote: str(body, 'quote') || current?.quote || '',
    names:
      body.names === undefined ? (current?.names ?? '') : str(body, 'names'),
    eventType:
      body.eventType === undefined
        ? (current?.eventType ?? '')
        : str(body, 'eventType'),
    town: body.town === undefined ? (current?.town ?? '') : str(body, 'town'),
    date: str(body, 'date') || current?.date || '',
    source: str(body, 'source') || current?.source || 'other',
    show:
      body.show === undefined ? (current?.show ?? false) : bool(body, 'show'),
  }
}

function botBooking(booking: BookingView) {
  return {
    ...booking,
    couple: `${booking.partnerOne} and ${booking.partnerTwo}`,
    weddingDate: booking.eventDate,
    venue: booking.venueName,
    streetAddress: booking.venueStreet,
    service: booking.packageId,
    paidCents: booking.invoice?.receivedCents ?? 0,
    priceCents: booking.invoice?.totalCents ?? booking.totalCents,
  }
}

function coupleNames(value: string): [string, string] {
  const parts = value.split(/\s+and\s+/i).map((part) => part.trim())
  return [parts[0] ?? '', parts[1] ?? '']
}

function str(body: Record<string, unknown>, key: string): string {
  const value = body[key]
  return typeof value === 'string' ? value : ''
}

function bool(body: Record<string, unknown>, key: string): boolean {
  return body[key] === true
}

function integer(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isInteger(value) ? value : fallback
}

function intId(value: string | null): number {
  const id = Number(value)
  if (!Number.isInteger(id)) throw new Error('Send an id.')
  return id
}

function money(body: Record<string, unknown>): number {
  if (typeof body.cents === 'number') return body.cents
  if (typeof body.priceCents === 'number') return body.priceCents
  if (typeof body.amountCents === 'number') return body.amountCents
  if (
    typeof body.amountDollars === 'string' ||
    typeof body.amountDollars === 'number'
  ) {
    return dollarsToCents(String(body.amountDollars))
  }
  throw new Error('Enter an amount.')
}

async function readBody(request: Request): Promise<Record<string, unknown>> {
  const body = (await request.json().catch(() => ({}))) as unknown
  if (!body || typeof body !== 'object' || Array.isArray(body)) return {}
  return body as Record<string, unknown>
}

function bearer(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : ''
}

function botJson(body: unknown, status = 200): Response {
  return Response.json(body, { status, headers: HEADERS })
}

async function remembered(
  token: string,
  key: string,
): Promise<Response | null> {
  await ensureIdempotency()
  const rows = await query<{ status: number; body: string }>(
    'SELECT status, body FROM bot_idempotency WHERE key = $1',
    [scopedKey(token, key)],
  )
  if (rows.length === 0) return null
  const row = rows[0]
  return botJson(JSON.parse(row.body) as unknown, Number(row.status))
}

async function remember(
  token: string,
  key: string,
  response: Response,
): Promise<void> {
  const copy = response.clone()
  const text = await copy.text()
  await query(
    `INSERT INTO bot_idempotency (key, status, body) VALUES ($1, $2, $3)
     ON CONFLICT (key) DO NOTHING`,
    [scopedKey(token, key), copy.status, text || '{}'],
  )
}

function scopedKey(token: string, key: string): string {
  return createHash('sha256')
    .update(token)
    .update('\n')
    .update(key)
    .digest('hex')
}

async function ensureIdempotency(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS bot_idempotency (
      key text PRIMARY KEY,
      status integer NOT NULL,
      body text NOT NULL
    )`,
  )
}

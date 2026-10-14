import { createServerFn } from '@tanstack/react-start'
import { getRequest } from '@tanstack/react-start/server'
import { travelFromKm } from './travel.ts'
import { drivingKm } from './travel.server.ts'
import { isPackageId, packageName } from './defaults.ts'
import { parseDateRequest, todayInToronto } from './date-request.ts'
import { emailOwner } from './mail.server.ts'
import { readPublicSite } from './public-site.server.ts'
import { readGoogleReviews } from './google-reviews.server.ts'
import {
  createEventInquiry,
  createInquiry,
  dateOpen,
  getTerms,
  listPackageOffers,
} from './store.server.ts'

export const getPublicSite = createServerFn({ method: 'GET' }).handler(
  async () => {
    const [site, google] = await Promise.all([
      readPublicSite(),
      readGoogleReviews(),
    ])
    return {
      ...site,
      // A snapshot cached before this setting existed shows both.
      reviewDisplay: site.reviewDisplay ?? { home: 'both', weddings: 'both' },
      google,
    }
  },
)

export const getPublicTerms = createServerFn({ method: 'GET' }).handler(
  async () => ({ body: await getTerms() }),
)

export const checkDate = createServerFn({ method: 'POST' })
  .validator((data: { date: string }) => data)
  .handler(async ({ data }) => {
    const open = await dateOpen(data.date)
    return { open }
  })

export const sendDateRequest = createServerFn({ method: 'POST' })
  .validator(
    (data: { date: string; eventType: string; company: string }) => data,
  )
  .handler(async ({ data }) => {
    const parsed = parseDateRequest(data, todayInToronto())
    if (!parsed.ok) return parsed
    if (parsed.silent) return { ok: true as const }
    let open = false
    try {
      open = await dateOpen(parsed.date)
    } catch {
      open = false
    }
    const result = await emailOwner({
      subject: `Date check: ${parsed.eventType} on ${parsed.date}`,
      text: [
        `A couple asked about a ${parsed.eventType.toLowerCase()} on ${parsed.date}.`,
        open
          ? 'The book shows that date as open.'
          : 'The book shows that date as held or blocked.',
      ].join('\n'),
    })
    if (!result.delivered) {
      return {
        ok: false as const,
        error:
          'That request did not send. Email PiperPWeddingDJ@gmail.com and Piper will write back.',
      }
    }
    return { ok: true as const }
  })

export const sendEventInquiry = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      name: string
      email: string
      phone: string
      eventDate: string
      event: string
      message: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const result = await createEventInquiry(data)
    if (!result.ok) return result
    try {
      await emailOwner({
        subject: `Inquiry from ${data.name.trim()}`,
        text: [
          data.name.trim(),
          data.email.trim(),
          data.phone.trim(),
          `Event: ${data.event.trim()}`,
          `Date: ${data.eventDate}`,
          `Note: ${data.message.trim()}`,
        ].join('\n'),
      })
    } catch {
      // The lead is already saved. Mail trouble must not hide the inquiry.
    }
    return result
  })

export const sendInquiry = createServerFn({ method: 'POST' })
  .validator(
    (data: {
      partnerOne: string
      partnerTwo: string
      email: string
      phone: string
      eventDate: string
      packageId: string
      withStag: boolean
      stagDate: string
      message: string
      venueName: string
      venueStreet: string
      venueTwoName: string
      venueTwoStreet: string
      referral: string
    }) => data,
  )
  .handler(async ({ data }) => {
    const result = await createInquiry({
      ...data,
      stagDate: data.stagDate || null,
    })
    if (!result.ok) return result
    const offers = await listPackageOffers()
    const packageLabel =
      offers.find((item) => item.id === data.packageId)?.name ??
      (isPackageId(data.packageId)
        ? packageName(data.packageId)
        : data.packageId)
    const stag = data.withStag
      ? `Yes${data.stagDate ? `, ${data.stagDate}` : ''}`
      : 'No'
    try {
      await emailOwner({
        subject: `Inquiry from ${data.partnerOne.trim()} and ${data.partnerTwo.trim()}`,
        text: [
          `${data.partnerOne.trim()} and ${data.partnerTwo.trim()}`,
          data.email.trim(),
          data.phone.trim(),
          `Wedding date: ${data.eventDate}`,
          `Package: ${packageLabel}`,
          `Stag and doe: ${stag}`,
          `Venue: ${data.venueName.trim()}`,
          `Venue street: ${data.venueStreet.trim()}`,
          data.venueTwoName.trim()
            ? `Second venue: ${data.venueTwoName.trim()} (${data.venueTwoStreet.trim()})`
            : '',
          data.referral.trim() ? `Referred by: ${data.referral.trim()}` : '',
          `Note: ${data.message.trim()}`,
        ].join('\n'),
      })
    } catch {
      // The lead is already saved. Mail trouble must not hide the inquiry.
    }
    return result
  })

const travelAsks = new Map<string, number[]>()

/** 30 travel look-ups a minute per visitor is plenty for typing an address. */
function travelAllowed(): boolean {
  let ip = 'local'
  try {
    const request = getRequest()
    ip =
      (request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for') ||
        'local').split(',')[0]?.trim() || 'local'
  } catch {
    // No request (tests): allow.
  }
  const now = Date.now()
  const recent = (travelAsks.get(ip) ?? []).filter((at) => now - at < 60_000)
  if (recent.length >= 30) return false
  recent.push(now)
  travelAsks.set(ip, recent)
  return true
}

/**
 * /book: the travel fee for the venue address the couple typed. Only the
 * fee and tier go back; the distance from home is not shown publicly.
 */
export const estimateTravel = createServerFn({ method: 'POST' })
  .validator((data: { address?: unknown; packageId?: unknown }) => ({
    address: typeof data.address === 'string' ? data.address.trim().slice(0, 200) : '',
    packageId:
      typeof data.packageId === 'string' && isPackageId(data.packageId)
        ? data.packageId
        : 'full',
  }))
  .handler(async ({ data }) => {
    if (!data.address) return { ok: false as const, reason: 'no-address' as const }
    if (!travelAllowed()) return { ok: false as const, reason: 'busy' as const }
    const found = await drivingKm(data.address)
    if (!found.ok) {
      return {
        ok: false as const,
        reason: found.reason === 'not-found' ? ('not-found' as const) : ('unavailable' as const),
      }
    }
    const figure = travelFromKm(found.km, data.packageId)
    return {
      ok: true as const,
      feeCents: figure.feeCents ?? 0,
      tier: figure.tier,
      hotel: figure.hotel,
    }
  })

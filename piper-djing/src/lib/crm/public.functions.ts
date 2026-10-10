import { createServerFn } from '@tanstack/react-start'
import { isPackageId, packageName } from './defaults.ts'
import { parseDateRequest, todayInToronto } from './date-request.ts'
import { emailOwner } from './mail.server.ts'
import {
  createInquiry,
  dateOpen,
  ensureSavedWeddings,
  homepageReviews,
  listPackageOffers,
  listPartners,
} from './store.server.ts'

export const getPublicSite = createServerFn({ method: 'GET' }).handler(
  async () => {
    await ensureSavedWeddings()
    return {
      reviews: await homepageReviews(),
      partners: await listPartners(),
      packages: await listPackageOffers(),
    }
  },
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
          `Note: ${data.message.trim()}`,
        ].join('\n'),
      })
    } catch {
      // The lead is already saved. Mail trouble must not hide the inquiry.
    }
    return result
  })

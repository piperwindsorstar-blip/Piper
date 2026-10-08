import { createServerFn } from '@tanstack/react-start'
import {
  createInquiry,
  dateOpen,
  ensureSavedWeddings,
  homepageReviews,
  listPartners,
} from './store.server.ts'

export const getPublicSite = createServerFn({ method: 'GET' }).handler(
  async () => {
    await ensureSavedWeddings()
    return {
      reviews: await homepageReviews(),
      partners: await listPartners(),
    }
  },
)

export const checkDate = createServerFn({ method: 'POST' })
  .validator((data: { date: string }) => data)
  .handler(async ({ data }) => {
    const open = await dateOpen(data.date)
    return { open }
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
    return createInquiry({
      ...data,
      stagDate: data.stagDate || null,
    })
  })

import { Outlet, createFileRoute } from '@tanstack/react-router'
import { DeskShell } from '../../components/desk-shell.tsx'
import { requireDeskPage } from '../../lib/auth/server.ts'
import {
  getBots,
  getLeads,
  getMedia,
  getOverview,
  getPartners,
  getPayments,
  getQuestions,
  getReviews,
} from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk')({
  head: () => deskHead('Desk · Piper DJing'),
  beforeLoad: () => requireDeskPage(),
  loader: async () => {
    const [
      overview,
      payments,
      leads,
      questions,
      media,
      partners,
      reviews,
      bots,
    ] = await Promise.all([
      getOverview(),
      getPayments(),
      getLeads(),
      getQuestions(),
      getMedia(),
      getPartners(),
      getReviews(),
      getBots(),
    ])
    return {
      overview,
      bookings: payments.bookings,
      payments: payments.payments,
      leads,
      questions,
      media,
      partners,
      reviews,
      bots,
    }
  },
  component: DeskLayout,
})

function DeskLayout() {
  const data = Route.useLoaderData()
  return (
    <DeskShell data={data}>
      <Outlet />
    </DeskShell>
  )
}

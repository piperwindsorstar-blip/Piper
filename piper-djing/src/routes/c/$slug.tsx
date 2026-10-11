import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { getCouple } from '../../lib/crm/desk.functions.ts'
import { openCouplePortal } from '../../lib/portal/portal.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/c/$slug')({
  head: () => privateHead('Your date · Piper DJing'),
  loader: async ({ params }) => {
    const booking = await getCouple({ data: { slug: params.slug } })
    if (!booking) throw notFound()
    const opened = await openCouplePortal({ data: { slug: params.slug } })
    if (!opened.ok) throw notFound()
    throw redirect({ to: '/portal' })
  },
})

import { createFileRoute, notFound, redirect } from '@tanstack/react-router'
import { getCouple } from '../../lib/crm/desk.functions.ts'
import { openCouplePortal } from '../../lib/portal/portal.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/c/$slug')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader']],
  head: () => privateHead('Your date · DJ Piper P'),
  loader: async ({ params }) => {
    const booking = await getCouple({ data: { slug: params.slug } })
    if (!booking) throw notFound()
    const opened = await openCouplePortal({ data: { slug: params.slug } })
    if (!opened.ok) throw notFound()
    throw redirect({ to: '/portal' })
  },
})

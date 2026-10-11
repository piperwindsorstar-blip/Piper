import { createFileRoute } from '@tanstack/react-router'
import { ReviewReply } from '../../../../../components/rsvp/household.tsx'
import { rsvpHead } from '../../../../../lib/rsvp/head.ts'
import { getHousehold } from '../../../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/$slug/p/$token/review')({
  head: () => rsvpHead('Check your RSVP · DJ Piper P'),
  loader: ({ params }) =>
    getHousehold({ data: { slug: params.slug, token: params.token } }),
  component: function Page() {
    const data = Route.useLoaderData()
    if (!data) return null
    return <ReviewReply data={data} />
  },
})

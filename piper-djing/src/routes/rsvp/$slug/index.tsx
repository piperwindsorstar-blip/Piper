import { createFileRoute } from '@tanstack/react-router'
import { GuestHome } from '../../../components/rsvp/guest-home.tsx'
import { rsvpHead } from '../../../lib/rsvp/head.ts'
import { getRsvpHome } from '../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/$slug/')({
  head: () => rsvpHead('Wedding RSVP · DJ Piper P'),
  loader: ({ params }) => getRsvpHome({ data: { slug: params.slug } }),
  component: function Page() {
    return <GuestHome data={Route.useLoaderData()} />
  },
})

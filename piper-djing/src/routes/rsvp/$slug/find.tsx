import { createFileRoute } from '@tanstack/react-router'
import { FindInvitation } from '../../../components/rsvp/guest-home.tsx'
import { rsvpHead } from '../../../lib/rsvp/head.ts'
import { getRsvpHome } from '../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/$slug/find')({
  head: () => rsvpHead('Find your invitation · DJ Piper P'),
  loader: async ({ params }) => {
    // Only the couple's shared text number, for "can't find your name".
    const home = await getRsvpHome({ data: { slug: params.slug } })
    if (!('contactPhone' in home)) return { name: '', phone: '' }
    return { name: home.contactName ?? '', phone: home.contactPhone ?? '' }
  },
  component: function Page() {
    const { slug } = Route.useParams()
    const contact = Route.useLoaderData()
    return <FindInvitation slug={slug} contact={contact} />
  },
})

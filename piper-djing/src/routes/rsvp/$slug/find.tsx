import { createFileRoute } from '@tanstack/react-router'
import { FindInvitation } from '../../../components/rsvp/guest-home.tsx'
import { rsvpHead } from '../../../lib/rsvp/head.ts'

export const Route = createFileRoute('/rsvp/$slug/find')({
  head: () => rsvpHead('Find your invitation · DJ Piper P'),
  component: function Page() {
    const { slug } = Route.useParams()
    return <FindInvitation slug={slug} />
  },
})

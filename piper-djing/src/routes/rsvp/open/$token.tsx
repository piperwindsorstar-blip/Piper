import { createFileRoute, redirect } from '@tanstack/react-router'
import { rsvpHead } from '../../../lib/rsvp/head.ts'
import { openRsvpSignIn } from '../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/open/$token')({
  head: () => rsvpHead('Opening your RSVP · DJ Piper P'),
  loader: async ({ params }) => {
    const opened = await openRsvpSignIn({ data: { token: params.token } })
    if (!opened.ok) {
      throw redirect({ to: '/rsvp/sign-in' })
    }
    throw redirect({ to: '/rsvp/manage' })
  },
})

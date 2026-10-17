import { createFileRoute, redirect } from '@tanstack/react-router'
import { rsvpHead } from '../../../lib/rsvp/head.ts'
import { openRsvpSignIn } from '../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/open/$token')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader']],
  head: () => rsvpHead('Opening your RSVP · DJ Piper P'),
  loader: async ({ params }) => {
    const opened = await openRsvpSignIn({ data: { token: params.token } })
    if (!opened.ok) {
      throw redirect({ to: '/rsvp/sign-in' })
    }
    throw redirect({ to: '/rsvp/manage' })
  },
})

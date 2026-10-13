import { createFileRoute } from '@tanstack/react-router'
import { SeatingChart } from '../../../components/rsvp/seating.tsx'
import { getRsvpSeating } from '../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/manage/seating')({
  loader: () => getRsvpSeating(),
  component: function Page() {
    const data = Route.useLoaderData()
    if (!data) return null
    return <SeatingChart data={data} />
  },
})

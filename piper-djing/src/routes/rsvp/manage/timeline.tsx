import { createFileRoute } from '@tanstack/react-router'
import { TimelineEditor } from '../../../components/rsvp/timeline.tsx'
import { getRsvpTimeline } from '../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/manage/timeline')({
  loader: () => getRsvpTimeline(),
  component: function Page() {
    const data = Route.useLoaderData()
    if (!data) return null
    return <TimelineEditor data={data} />
  },
})

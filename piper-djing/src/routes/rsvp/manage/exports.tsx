import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Exports } from '../../../components/rsvp/manage.tsx'
import {
  getRsvpSeating,
  getRsvpTimeline,
} from '../../../lib/rsvp/rsvp.functions.ts'

const parent = getRouteApi('/rsvp/manage')

export const Route = createFileRoute('/rsvp/manage/exports')({
  loader: async () => {
    const [seating, timeline] = await Promise.all([
      getRsvpSeating(),
      getRsvpTimeline(),
    ])
    return { seating, timeline }
  },
  component: function Page() {
    const data = parent.useLoaderData()
    const sheets = Route.useLoaderData()
    if (!data || data.mode !== 'ready') return null
    return <Exports data={data} sheets={sheets} />
  },
})

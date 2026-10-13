import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Exports } from '../../../components/rsvp/manage.tsx'
import {
  getCatererSheet,
  getRsvpSeating,
  getRsvpTimeline,
} from '../../../lib/rsvp/rsvp.functions.ts'

const parent = getRouteApi('/rsvp/manage')

export const Route = createFileRoute('/rsvp/manage/exports')({
  loader: async () => {
    const [seating, timeline, caterer] = await Promise.all([
      getRsvpSeating(),
      getRsvpTimeline(),
      getCatererSheet(),
    ])
    return { seating, timeline, caterer }
  },
  component: function Page() {
    const data = parent.useLoaderData()
    const sheets = Route.useLoaderData()
    if (!data || data.mode !== 'ready') return null
    return <Exports data={data} sheets={sheets} />
  },
})

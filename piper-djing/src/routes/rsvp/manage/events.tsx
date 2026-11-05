import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Events } from '../../../components/rsvp/manage.tsx'

const parent = getRouteApi('/rsvp/manage')

export const Route = createFileRoute('/rsvp/manage/events')({
  component: function Page() {
    const data = parent.useLoaderData()
    if (!data || data.mode !== 'ready') return null
    return <Events data={data} />
  },
})

import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Guests } from '../../../components/rsvp/manage.tsx'

const parent = getRouteApi('/rsvp/manage')

export const Route = createFileRoute('/rsvp/manage/guests')({
  component: function Page() {
    const data = parent.useLoaderData()
    if (!data || data.mode !== 'ready') return null
    return <Guests data={data} />
  },
})

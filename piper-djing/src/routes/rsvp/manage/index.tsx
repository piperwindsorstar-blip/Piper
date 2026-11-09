import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Overview } from '../../../components/rsvp/manage.tsx'

const parent = getRouteApi('/rsvp/manage')

export const Route = createFileRoute('/rsvp/manage/')({
  component: function Page() {
    const data = parent.useLoaderData()
    if (!data || data.mode !== 'ready') return null
    return <Overview data={data} />
  },
})

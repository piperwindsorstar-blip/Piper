import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Exports } from '../../../components/rsvp/manage.tsx'

const parent = getRouteApi('/rsvp/manage')

export const Route = createFileRoute('/rsvp/manage/exports')({
  component: function Page() {
    const data = parent.useLoaderData()
    if (!data || data.mode !== 'ready') return null
    return <Exports data={data} />
  },
})

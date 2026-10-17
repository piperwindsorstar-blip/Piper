import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Design } from '../../../components/rsvp/design.tsx'

const parent = getRouteApi('/rsvp/manage')

export const Route = createFileRoute('/rsvp/manage/design')({
  component: function Page() {
    const data = parent.useLoaderData()
    if (!data || data.mode !== 'ready') return null
    return <Design data={data} />
  },
})

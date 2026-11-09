import { createFileRoute, getRouteApi } from '@tanstack/react-router'
import { Settings } from '../../../components/rsvp/manage.tsx'

const parent = getRouteApi('/rsvp/manage')

export const Route = createFileRoute('/rsvp/manage/settings')({
  component: function Page() {
    const data = parent.useLoaderData()
    if (!data || data.mode !== 'ready') return null
    return <Settings data={data} />
  },
})

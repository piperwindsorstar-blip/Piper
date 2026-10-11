import { createFileRoute } from '@tanstack/react-router'
import { HouseholdForm } from '../../../../../components/rsvp/household.tsx'
import { rsvpHead } from '../../../../../lib/rsvp/head.ts'
import { getHousehold } from '../../../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/$slug/p/$token/')({
  head: () => rsvpHead('Your RSVP · DJ Piper P'),
  loader: ({ params }) =>
    getHousehold({ data: { slug: params.slug, token: params.token } }),
  component: function Page() {
    const data = Route.useLoaderData()
    if (!data) {
      return (
        <main className="portal grid min-h-screen place-items-center px-6">
          <h1 className="portal-display text-4xl">
            That invitation link does not match.
          </h1>
        </main>
      )
    }
    return <HouseholdForm data={data} />
  },
})

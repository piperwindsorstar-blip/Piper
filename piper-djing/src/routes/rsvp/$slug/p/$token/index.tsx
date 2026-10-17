import { createFileRoute } from '@tanstack/react-router'
import { HouseholdForm } from '../../../../../components/rsvp/household.tsx'
import { RsvpThemeProvider } from '../../../../../components/rsvp/shell.tsx'
import { rsvpHead } from '../../../../../lib/rsvp/head.ts'
import { getHousehold } from '../../../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/$slug/p/$token/')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
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
    return (
      <RsvpThemeProvider
        theme={data.theme}
        template={data.template}
        tint={data.tint}
        photo={data.photo}
      >
        <HouseholdForm data={data} />
      </RsvpThemeProvider>
    )
  },
})

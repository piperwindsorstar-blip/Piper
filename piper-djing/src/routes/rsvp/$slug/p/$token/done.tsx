import { createFileRoute } from '@tanstack/react-router'
import { ReplyDone } from '../../../../../components/rsvp/household.tsx'
import { RsvpThemeProvider } from '../../../../../components/rsvp/shell.tsx'
import { rsvpHead } from '../../../../../lib/rsvp/head.ts'
import { getHousehold } from '../../../../../lib/rsvp/rsvp.functions.ts'

type DoneSearch = { sent: string }

export const Route = createFileRoute('/rsvp/$slug/p/$token/done')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => rsvpHead("You're on the list · DJ Piper P"),
  validateSearch: (search: Record<string, unknown>): DoneSearch => ({
    sent: search.sent === '1' ? '1' : '',
  }),
  loader: ({ params }) =>
    getHousehold({ data: { slug: params.slug, token: params.token } }),
  component: function Page() {
    const data = Route.useLoaderData()
    const { sent } = Route.useSearch()
    if (!data) return null
    return (
      <RsvpThemeProvider
        theme={data.theme}
        template={data.template}
        tint={data.tint}
        photo={data.photo}
      >
        <ReplyDone data={data} sent={sent === '1'} />
      </RsvpThemeProvider>
    )
  },
})

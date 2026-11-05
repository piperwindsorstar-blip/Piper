import { createFileRoute } from '@tanstack/react-router'
import { FindInvitation } from '../../../components/rsvp/guest-home.tsx'
import { RsvpThemeProvider } from '../../../components/rsvp/shell.tsx'
import { rsvpHead } from '../../../lib/rsvp/head.ts'
import { getRsvpHome } from '../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/$slug/find')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => rsvpHead('Find your invitation · DJ Piper P'),
  loader: async ({ params }) => {
    // The couple's style, and only their shared text number for "can't find your name".
    const home = await getRsvpHome({ data: { slug: params.slug } })
    const style = {
      theme: 'theme' in home && home.theme ? home.theme : ('dark' as const),
      template: 'template' in home ? home.template : ('ivory' as const),
      tint: 'tint' in home ? home.tint : 0,
    }
    if (!('contactPhone' in home)) return { ...style, name: '', phone: '' }
    return { ...style, name: home.contactName ?? '', phone: home.contactPhone ?? '' }
  },
  component: function Page() {
    const { slug } = Route.useParams()
    const data = Route.useLoaderData()
    return (
      <RsvpThemeProvider theme={data.theme} template={data.template} tint={data.tint}>
        <FindInvitation slug={slug} contact={{ name: data.name, phone: data.phone }} />
      </RsvpThemeProvider>
    )
  },
})

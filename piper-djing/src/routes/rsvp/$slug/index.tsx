import { createFileRoute } from '@tanstack/react-router'
import { GuestHome } from '../../../components/rsvp/guest-home.tsx'
import { RsvpThemeProvider } from '../../../components/rsvp/shell.tsx'
import { rsvpHead } from '../../../lib/rsvp/head.ts'
import { getRsvpHome } from '../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/$slug/')({
  head: () => rsvpHead('Wedding RSVP · DJ Piper P'),
  loader: ({ params }) => getRsvpHome({ data: { slug: params.slug } }),
  component: function Page() {
    const data = Route.useLoaderData()
    const theme = 'theme' in data && data.theme ? data.theme : 'dark'
    return (
      <RsvpThemeProvider
        theme={theme}
        template={'template' in data ? data.template : 'ivory'}
        tint={'tint' in data ? data.tint : 0}
        photo={'photo' in data ? data.photo : null}
      >
        <GuestHome data={data} />
      </RsvpThemeProvider>
    )
  },
})

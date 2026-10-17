import { Link, Outlet, createFileRoute } from '@tanstack/react-router'
import { ManageShell, PayWall } from '../../../components/rsvp/manage.tsx'
import { rsvpHead } from '../../../lib/rsvp/head.ts'
import { getRsvpManage } from '../../../lib/rsvp/rsvp.functions.ts'

export const Route = createFileRoute('/rsvp/manage')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => rsvpHead('Your RSVP · DJ Piper P'),
  loader: () => getRsvpManage(),
  component: ManageLayout,
})

function ManageLayout() {
  const data = Route.useLoaderData()
  if (!data) {
    return (
      <main className="portal grid min-h-screen place-items-center px-6 text-center">
        <div>
          <h1 className="portal-display text-4xl">Sign in to your RSVP</h1>
          <Link
            to="/rsvp/sign-in"
            className="mt-6 inline-flex min-h-11 items-center text-[var(--pink-soft)]"
          >
            Email me a sign-in link
          </Link>
        </div>
      </main>
    )
  }
  if (data.mode === 'pay') return <PayWall data={data} />
  return (
    <ManageShell data={data}>
      <Outlet />
    </ManageShell>
  )
}

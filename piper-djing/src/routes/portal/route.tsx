import { Outlet, createFileRoute } from '@tanstack/react-router'
import { PortalChrome } from '../../components/portal/portal-chrome.tsx'
import { PortalProvider } from '../../components/portal/portal-state.tsx'
import type { PortalPage } from '../../components/portal/portal-state.tsx'
import { getPortal } from '../../lib/portal/portal.functions.ts'
import { privateHead } from '../../lib/seo.ts'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Display:wght@800;900&display=swap'

export const Route = createFileRoute('/portal')({
  head: () => {
    const head = privateHead('Your plan · DJ Piper P')
    return {
      ...head,
      links: [{ rel: 'stylesheet', href: FONTS }],
    }
  },
  loader: () => getPortal(),
  component: PortalLayout,
})

function PortalLayout() {
  const page = Route.useLoaderData()
  if (!page) {
    return (
      <main className="portal px-6 py-24">
        <h1 className="portal-display text-4xl">
          This page opens from the link Piper sent you.
        </h1>
      </main>
    )
  }
  return (
    <PortalProvider page={toPage(page)}>
      <PortalChrome>
        <Outlet />
      </PortalChrome>
    </PortalProvider>
  )
}

function toPage(
  page: NonNullable<Awaited<ReturnType<typeof getPortal>>>,
): PortalPage {
  return {
    partnerOne: page.partnerOne,
    partnerTwo: page.partnerTwo,
    eventDate: page.eventDate,
    packageName: page.packageName,
    venueName: page.venueName,
    invoiceSlug: page.invoiceSlug,
    slug: page.slug,
    today: page.today,
    locked: page.locked,
    planning: page.planning,
  }
}

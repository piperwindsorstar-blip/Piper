import { createFileRoute } from '@tanstack/react-router'
import { TownPage } from '../components/weddings/town-page.tsx'
import { TOWNS } from '../components/weddings/towns.ts'
import { getPublicSite } from '../lib/crm/public.functions.ts'
import { townHead } from '../lib/town-head.ts'

const town = TOWNS['/paris-wedding-dj']

export const Route = createFileRoute('/paris-wedding-dj')({
  loader: () => getPublicSite(),
  staleTime: 5 * 60 * 1000,
  head: () => townHead(town),
  component: Page,
})

function Page() {
  const { reviews, packages, google, reviewDisplay } = Route.useLoaderData()
  return (
    <TownPage
      town={town}
      reviews={reviews}
      packages={packages}
      google={google}
      display={reviewDisplay.weddings}
    />
  )
}

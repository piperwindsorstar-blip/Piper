import { createFileRoute } from '@tanstack/react-router'
import { DateCalendarDialog } from '../components/weddings/date-calendar.tsx'
import { DateDraftProvider } from '../components/weddings/date-draft.tsx'
import { Header } from '../components/weddings/header.tsx'
import { SiteFooter } from '../components/weddings/site-footer.tsx'
import { getPublicVendors } from '../lib/crm/public.functions.ts'
import type { PublicVendor } from '../lib/crm/vendors.ts'
import { publicHead } from '../lib/seo.ts'

export const Route = createFileRoute('/wedding-vendors')({
  // Rendered on the server, so the list is in the page's HTML.
  loader: () => getPublicVendors(),
  head: () =>
    publicHead({
      path: '/wedding-vendors',
      title: 'Brantford wedding vendors I love working with | DJ Piper P',
      description:
        'Photographers, venues, planners and more that DJ Piper P loves working with at weddings in Brantford, Hamilton, Paris and nearby.',
    }),
  component: VendorsPage,
})

function VendorsPage() {
  const { groups } = Route.useLoaderData()
  return (
    <DateDraftProvider>
      <div className="weddings bp-town min-h-screen overflow-x-clip bg-paper font-sans text-ink">
        <Header sectionBase="/weddings" />
        <DateCalendarDialog />
        <main>
          <section className="bp-full bp-pad bp-banner">
            <img
              src="/photos/uplighting/uplighting-reception-room.jpg"
              alt=""
              className="bp-bg"
              fetchPriority="high"
              sizes="100vw"
            />
            <p className="bp-k bp-town__accent">Brantford wedding vendors</p>
            <h1 className="bp-h1 mt-4 max-w-4xl text-[clamp(2.6rem,7vw,5.2rem)]">
              Vendors I love working with
            </h1>
            <p className="mt-5 max-w-2xl text-lg leading-relaxed font-medium">
              These are the Brantford-area wedding pros I’ve worked alongside and
              trust. Click a logo to visit their site.
            </p>
          </section>
          <div className="mx-auto w-full max-w-6xl px-5 pt-2 pb-16">
          {groups.map((group) => (
            <section key={group.id} className="mt-12">
              <h2 className="font-display text-2xl font-bold tracking-tight md:text-3xl">
                {group.name}
              </h2>
              <ul className="mt-5 grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
                {group.vendors.map((vendor) => (
                  <li key={vendor.id}>
                    <VendorCard vendor={vendor} />
                  </li>
                ))}
              </ul>
            </section>
          ))}
          </div>
        </main>
        <SiteFooter />
      </div>
    </DateDraftProvider>
  )
}

function VendorCard({ vendor }: { vendor: PublicVendor }) {
  return (
    <a
      href={vendor.href}
      target="_blank"
      rel="noopener"
      className="group flex h-full flex-col items-center gap-3 rounded-2xl border border-line bg-white p-4 text-center text-plum transition hover:-translate-y-0.5 hover:border-neon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon"
    >
      {vendor.logo ? (
        <>
          <span className="flex h-24 w-full items-center justify-center">
            <img
              src={vendor.logo}
              alt={`${vendor.name} logo`}
              loading="lazy"
              className="max-h-24 max-w-full object-contain"
            />
          </span>
          <span className="font-semibold leading-snug group-hover:text-neon">
            {vendor.name}
          </span>
        </>
      ) : (
        <span className="flex min-h-24 w-full flex-1 items-center justify-center rounded-xl bg-blush px-3 py-4">
          <span className="font-serif text-2xl leading-tight text-plum italic group-hover:text-neon">
            {vendor.name}
          </span>
        </span>
      )}
    </a>
  )
}

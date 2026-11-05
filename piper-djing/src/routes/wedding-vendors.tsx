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
      <div className="weddings min-h-screen overflow-x-clip bg-paper font-sans text-ink">
        <Header sectionBase="/weddings" />
        <DateCalendarDialog />
        <main className="mx-auto w-full max-w-6xl px-5 py-16">
          <h1 className="font-display text-4xl font-extrabold tracking-tight text-balance md:text-5xl">
            Vendors I love working with
          </h1>
          <p className="mt-4 max-w-2xl text-lg leading-relaxed text-soft">
            These are the Brantford-area wedding pros I’ve worked alongside and
            trust. Click a logo to visit their site.
          </p>
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
      className="group flex h-full flex-col items-center gap-3 rounded-2xl border border-line bg-white p-4 text-center transition hover:-translate-y-0.5 hover:border-neon focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neon"
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
          <span className="font-serif text-2xl leading-tight text-ink italic group-hover:text-neon">
            {vendor.name}
          </span>
        </span>
      )}
    </a>
  )
}

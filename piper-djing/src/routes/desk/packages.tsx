import { createFileRoute } from '@tanstack/react-router'
import { getPackages } from '../../lib/crm/desk.functions.ts'
import { cad } from '../../lib/crm/money.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/packages')({
  head: () => privateHead('Packages · Piper DJing'),
  loader: () => getPackages(),
  component: PackagesPage,
})

function PackagesPage() {
  const packages = Route.useLoaderData()
  return (
    <div className="grid gap-4">
      <h1 className="font-display text-4xl tracking-tight">Packages</h1>
      <p className="text-sm text-muted">
        These amounts are listed on the public packages.
      </p>
      {packages.map((item) => (
        <article
          key={item.id}
          className="rounded-card border border-line bg-ivory px-5 py-5"
        >
          <div className="flex items-baseline justify-between gap-4">
            <h2 className="font-display text-2xl">{item.name}</h2>
            <p className="font-display text-2xl tabular-nums">
              {cad(item.cents)}
            </p>
          </div>
          <p className="mt-3 text-sm text-ink-soft">{item.detail}</p>
        </article>
      ))}
      <p className="text-sm text-muted">
        A full wedding day plus a stag is one booking. Wired uplights are{' '}
        {cad(1500)} each. Travel is calculated from kilometres, with the first
        20 included.
      </p>
    </div>
  )
}

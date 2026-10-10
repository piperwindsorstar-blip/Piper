import { createFileRoute } from '@tanstack/react-router'
import { DeskTitle, deskCard } from '../../components/desk-ui.tsx'
import { getPackages } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { cad } from '../../lib/crm/money.ts'

export const Route = createFileRoute('/desk/packages')({
  head: () => deskHead('Packages · Piper DJing'),
  loader: () => getPackages(),
  component: PackagesPage,
})

function PackagesPage() {
  const packages = Route.useLoaderData()
  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Packages" title="Packages">
        <p className="mt-1 text-sm text-white/65">
          These amounts are listed on the public packages.
        </p>
      </DeskTitle>
      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((item) => (
          <article key={item.id} className={deskCard}>
            <div className="flex items-baseline justify-between gap-4">
              <h2 className="font-display text-xl font-bold">{item.name}</h2>
              <p className="font-display text-2xl font-bold tabular-nums">
                {cad(item.cents)}
              </p>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-white/65">
              {item.detail}
            </p>
          </article>
        ))}
      </div>
      <p className="text-sm text-white/65">
        A full wedding day plus a stag is one booking. Wired uplights are{' '}
        {cad(1500)} each. Travel is calculated from kilometres, with the first
        20 included.
      </p>
    </div>
  )
}

import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { DeskTitle, deskCard, deskPrimary } from '../../components/desk-ui.tsx'
import { getPackages, savePackage } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { cad, dollarsToCents } from '../../lib/crm/money.ts'
import type { PackageOffer } from '../../lib/crm/packages.ts'

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
          These amounts are listed on the public packages. Saving a price
          changes that listing and the next quote. A date already on the book
          keeps its total until that booking is saved again.
        </p>
      </DeskTitle>
      <div className="grid gap-4 md:grid-cols-2">
        {packages.map((item) => (
          <PackageCard key={item.id} item={item} />
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

function PackageCard({ item }: { item: PackageOffer }) {
  const save = useServerFn(savePackage)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <form
      className={`${deskCard} grid gap-3`}
      onSubmit={(event) => {
        event.preventDefault()
        const form = new FormData(event.currentTarget)
        try {
          const cents = dollarsToCents(String(form.get('price') ?? ''))
          void save({
            data: {
              id: item.id,
              name: String(form.get('name') ?? ''),
              detail: String(form.get('detail') ?? ''),
              cents,
            },
          }).then(async (result) => {
            setNotice(result.ok ? 'Saved.' : result.error)
            if (result.ok) await router.invalidate()
          })
        } catch (error) {
          setNotice(error instanceof Error ? error.message : 'Enter a price.')
        }
      }}
    >
      <label className="field">
        Name
        <input name="name" required defaultValue={item.name} />
      </label>
      <label className="field">
        Price
        <input
          name="price"
          inputMode="decimal"
          required
          defaultValue={(item.cents / 100).toFixed(2)}
        />
      </label>
      <label className="field">
        Detail
        <textarea name="detail" required rows={5} defaultValue={item.detail} />
      </label>
      <button type="submit" className={`${deskPrimary} w-fit`}>
        Save the package
      </button>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
    </form>
  )
}

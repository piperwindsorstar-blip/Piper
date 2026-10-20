import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  DeskTitle,
  deskCard,
  deskPrimary,
  deskSurface,
} from '../../components/desk-ui.tsx'
import { getPackages, savePackage } from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'
import { cad, dollarsToCents } from '../../lib/crm/money.ts'
import { DESK_TRAVEL_COPY } from '../../lib/crm/travel-copy.ts'
import type { PackageOffer } from '../../lib/crm/packages.ts'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'

export const Route = createFileRoute('/desk/packages')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Packages · DJ Piper P'),
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
        A full wedding day plus a stag is one booking with a $500 deposit. The
        Pre-Party on its own is a flat $350 deposit. A wedding or a reception on
        its own is 30% of the total, to the nearest $25. Ceremony only is $350
        paid in full. Wired uplights are {cad(1500)} each. {DESK_TRAVEL_COPY}
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
      onSubmit={(event) => event.preventDefault()}
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
          pattern="[0-9]+(\.[0-9]{1,2})?"
          defaultValue={(item.cents / 100).toFixed(2)}
        />
      </label>
      <label className="field">
        Detail
        <textarea name="detail" required rows={5} defaultValue={item.detail} />
      </label>
      <ActionButton
        className={`${deskPrimary} w-fit`}
        checkForm
        busy="Saving…"
        done="Saved"
        surface={deskSurface}
        onRun={async (form: FormData): Promise<RunResult | undefined> => {
          try {
            const cents = dollarsToCents(String(form.get('price') ?? ''))
            if (cents <= 0) throw new Error('Enter a price above $0.')
            const result = await save({
              data: {
                id: item.id,
                name: String(form.get('name') ?? ''),
                detail: String(form.get('detail') ?? ''),
                cents,
              },
            })
            setNotice(result.ok ? 'Saved.' : result.error)
            if (result.ok) await router.invalidate()
            return {
              ok: result.ok,
              message: result.ok ? 'Saved.' : result.error,
            }
          } catch (error) {
            const message =
              error instanceof Error ? error.message : 'Enter a price.'
            setNotice(message)
            return { ok: false, message }
          }
        }}
      >
        Save the package
      </ActionButton>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
    </form>
  )
}

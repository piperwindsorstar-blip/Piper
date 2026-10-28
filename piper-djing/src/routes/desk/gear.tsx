import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  ConfirmDelete,
  DeskTitle,
  deskCard,
  deskDanger,
  deskGhost,
  deskH2,
  deskPrimary,
  deskSurface,
} from '../../components/desk-ui.tsx'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'
import { deleteGear, getGear, saveGear, saveNewGear } from '../../lib/gear/gear.functions.ts'
import { gearDateLabel, gearDollars, gearTotalCents } from '../../lib/gear/gear.ts'
import type { GearDraft, GearItem } from '../../lib/gear/gear.ts'
import { deskHead } from '../../lib/desk-head.ts'

/** Private: the Desk's gear record. Never linked from or shown on the public site. */
export const Route = createFileRoute('/desk/gear')({
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Gear · DJ Piper P'),
  loader: () => getGear(),
  component: GearPage,
})

type Result = { ok: true } | { ok: false; error: string }

function draftFrom(form: FormData): GearDraft {
  return {
    item: String(form.get('item') ?? ''),
    serial: String(form.get('serial') ?? ''),
    purchased: String(form.get('purchased') ?? ''),
    value: String(form.get('value') ?? ''),
    notes: String(form.get('notes') ?? ''),
  }
}

function asRun(result: Result, done: string): RunResult {
  return result.ok ? { ok: true, message: done } : { ok: false, message: result.error }
}

function GearFields({ item }: { item?: GearItem }) {
  return (
    <>
      <label className="field">
        Item
        <input name="item" required maxLength={200} defaultValue={item?.item ?? ''} />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="field">
          Serial number
          <input
            name="serial"
            maxLength={80}
            placeholder="Unknown"
            defaultValue={item?.serial ?? ''}
          />
        </label>
        <label className="field">
          Purchase date (YYYY-MM or YYYY-MM-DD)
          <input
            name="purchased"
            inputMode="numeric"
            placeholder="2026-10"
            pattern="\d{4}-\d{2}(-\d{2})?"
            defaultValue={item?.purchased ?? ''}
          />
        </label>
      </div>
      <label className="field">
        Replacement value (CAD)
        <input
          name="value"
          inputMode="decimal"
          placeholder="Not priced yet"
          defaultValue={item?.valueCents == null ? '' : String(item.valueCents / 100)}
        />
      </label>
      <label className="field">
        Status / notes
        <textarea name="notes" rows={2} maxLength={500} defaultValue={item?.notes ?? ''} />
      </label>
    </>
  )
}

function GearPage() {
  const items = Route.useLoaderData()
  const router = useRouter()
  const add = useServerFn(saveNewGear)
  const total = gearTotalCents(items)
  const unpriced = items.filter((item) => item.valueCents === null).length

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Business" title="Gear">
        <p>Private record of your equipment. It never shows on the website.</p>
      </DeskTitle>

      <section className={`${deskCard} flex flex-wrap items-end justify-between gap-3`}>
        <div>
          <p className="text-sm font-semibold text-[#4a4262]">Total replacement value</p>
          <p className="font-display text-4xl font-extrabold" data-gear-total>
            {gearDollars(total)}
          </p>
        </div>
        <p className="text-sm text-[#4a4262]">
          {`${items.length} ${items.length === 1 ? 'item' : 'items'}${unpriced > 0 ? ` · ${unpriced} not priced yet` : ''}`}
        </p>
      </section>

      <form className={`${deskCard} grid gap-3`} onSubmit={(event) => event.preventDefault()}>
        <h2 className={deskH2}>Add gear</h2>
        <GearFields />
        <ActionButton
          className={`${deskPrimary} w-fit`}
          checkForm
          busy="Saving…"
          done="Added"
          surface={deskSurface}
          onRun={async (form, element) => {
            const result = await add({ data: draftFrom(form) })
            if (result.ok) {
              element?.reset()
              await router.invalidate()
            }
            return asRun(result, 'Added.')
          }}
        >
          Add the item
        </ActionButton>
      </form>

      {items.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d6cce8] p-6 text-center text-sm text-[#4a4262]">
          No gear yet.
        </p>
      ) : (
        <ul className="grid gap-2" aria-label="Gear">
          {items.map((item) => (
            <GearRow key={item.id} item={item} />
          ))}
        </ul>
      )}
    </div>
  )
}

function GearRow({ item }: { item: GearItem }) {
  const router = useRouter()
  const save = useServerFn(saveGear)
  const remove = useServerFn(deleteGear)
  const [editing, setEditing] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <li className={`${deskCard} !p-4`} data-gear-id={item.id}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <p className="font-semibold">{item.item}</p>
          <dl className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-[#4a4262]">
            <div className="flex gap-1">
              <dt>Serial:</dt>
              <dd className="font-mono">{item.serial || '—'}</dd>
            </div>
            <div className="flex gap-1">
              <dt>Bought:</dt>
              <dd>{item.purchased ? gearDateLabel(item.purchased) : '—'}</dd>
            </div>
          </dl>
          {item.notes ? <p className="mt-1 text-sm text-[#1c1533]">{item.notes}</p> : null}
        </div>
        <p className="font-display text-xl font-bold whitespace-nowrap">
          {item.valueCents === null ? (
            <span className="text-sm font-semibold text-[#4a4262]">Not priced</span>
          ) : (
            gearDollars(item.valueCents)
          )}
        </p>
      </div>
      <div className="mt-3">
        <button type="button" className={deskGhost} onClick={() => setEditing(!editing)}>
          {editing ? 'Close' : 'Edit'}
        </button>
      </div>
      {notice ? <p className="mt-2 text-sm text-rose-700">{notice}</p> : null}
      {editing ? (
        <form className="mt-3 grid gap-3" onSubmit={(event) => event.preventDefault()}>
          <GearFields item={item} />
          <div className="flex flex-wrap gap-3">
            <ActionButton
              className={deskPrimary}
              checkForm
              busy="Saving…"
              done="Saved"
              surface={deskSurface}
              onRun={async (form) => {
                const result = await save({ data: { id: item.id, ...draftFrom(form) } })
                if (result.ok) {
                  setEditing(false)
                  await router.invalidate()
                }
                return asRun(result, 'Saved.')
              }}
            >
              Save
            </ActionButton>
            <ConfirmDelete
              className={deskDanger}
              onConfirm={() => {
                void remove({ data: { id: item.id } }).then(async (result) => {
                  setNotice(result.ok ? null : result.error)
                  if (result.ok) await router.invalidate()
                })
              }}
            >
              Delete item
            </ConfirmDelete>
          </div>
        </form>
      ) : null}
    </li>
  )
}

import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  ConfirmDelete,
  DeskTitle,
  ShowSwitch,
  deskCard,
  deskDanger,
  deskGhost,
  deskH2,
  deskPrimary,
  deskSurface,
} from '../../components/desk-ui.tsx'
import { ActionButton } from '../../components/action-button.tsx'
import type { RunResult } from '../../components/action-button.tsx'
import {
  deleteBrand,
  getDeskBrands,
  saveBrand,
  saveNewBrand,
  shiftBrand,
  showBrand,
} from '../../lib/crm/brands.functions.ts'
import type { DeskBrand } from '../../lib/crm/brands.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/brands')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Brands · DJ Piper P'),
  loader: () => getDeskBrands(),
  component: BrandsPage,
})

type Result = { ok: true } | { ok: false; error: string }

function asRun(result: Result, done: string): RunResult {
  return result.ok ? { ok: true, message: done } : { ok: false, message: result.error }
}

function failed(error: unknown): RunResult {
  return { ok: false, message: error instanceof Error ? error.message : 'That did not save.' }
}

function BrandsPage() {
  const brands = Route.useLoaderData()
  const router = useRouter()
  const add = useServerFn(saveNewBrand)
  const [shown, setShown] = useState(true)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Website" title="Brands">
        <p>
          The “Brands I’ve worked with” strip on the home page and /weddings. Changes are
          live as soon as you save. The strip stays hidden until a brand is shown.
        </p>
      </DeskTitle>

      <form className={`${deskCard} grid gap-3`} onSubmit={(event) => event.preventDefault()}>
        <h2 className={deskH2}>Add a brand</h2>
        <label className="field">
          Name
          <input name="name" required maxLength={80} />
        </label>
        <label className="field">
          Link (optional)
          <input name="href" type="url" placeholder="https://" pattern="https://.*" />
        </label>
        <ShowSwitch checked={shown} onChange={setShown} />
        <ActionButton
          className={`${deskPrimary} w-fit`}
          checkForm
          busy="Saving…"
          done="Added"
          surface={deskSurface}
          onRun={async (form, element) => {
            try {
              const result = await add({
                data: {
                  name: String(form.get('name') ?? ''),
                  href: String(form.get('href') ?? ''),
                  shown,
                },
              })
              if (result.ok) {
                element?.reset()
                setShown(true)
                await router.invalidate()
              }
              return asRun(result, 'Added.')
            } catch (error) {
              return failed(error)
            }
          }}
        >
          Add the brand
        </ActionButton>
      </form>

      {brands.length === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d6cce8] p-6 text-center text-sm text-[#4a4262]">
          No brands yet. The strip stays hidden.
        </p>
      ) : (
        <ul className="grid gap-2">
          {brands.map((brand, index) => (
            <BrandRow
              key={brand.id}
              brand={brand}
              first={index === 0}
              last={index === brands.length - 1}
            />
          ))}
        </ul>
      )}
    </div>
  )
}

function BrandRow({ brand, first, last }: { brand: DeskBrand; first: boolean; last: boolean }) {
  const router = useRouter()
  const save = useServerFn(saveBrand)
  const remove = useServerFn(deleteBrand)
  const show = useServerFn(showBrand)
  const shift = useServerFn(shiftBrand)
  const [editing, setEditing] = useState(false)
  const [shown, setShown] = useState(brand.shown)
  const [moving, setMoving] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  const move = (direction: 'up' | 'down') => {
    setMoving(true)
    void shift({ data: { id: brand.id, direction } })
      .then(async (result) => {
        if (!result.ok) setNotice(result.error)
        await router.invalidate()
      })
      .finally(() => setMoving(false))
  }
  const arrow =
    'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#d6cce8] bg-white text-lg font-semibold text-[#1c1533] transition hover:border-[#ff007f] disabled:opacity-30'

  return (
    <li className={`${deskCard} !p-4`}>
      <div className="flex flex-wrap items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{brand.name}</p>
          {brand.href ? (
            <a
              href={brand.href}
              target="_blank"
              rel="noopener"
              className="block truncate text-sm text-[#d1006b] underline"
            >
              {brand.href}
            </a>
          ) : (
            <p className="text-sm text-[#4a4262]">No link</p>
          )}
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className={arrow}
            disabled={first || moving}
            aria-label={`Move ${brand.name} up`}
            onClick={() => move('up')}
          >
            ↑
          </button>
          <button
            type="button"
            className={arrow}
            disabled={last || moving}
            aria-label={`Move ${brand.name} down`}
            onClick={() => move('down')}
          >
            ↓
          </button>
        </div>
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <ShowSwitch
          checked={shown}
          onChange={(next) => {
            setShown(next)
            void show({ data: { id: brand.id, shown: next } }).then(async (result) => {
              if (!result.ok) {
                setShown(!next)
                setNotice(result.error)
              } else {
                setNotice(null)
                await router.invalidate()
              }
            })
          }}
        />
        <button type="button" className={deskGhost} onClick={() => setEditing(!editing)}>
          {editing ? 'Close' : 'Edit'}
        </button>
      </div>
      {notice ? <p className="mt-2 text-sm text-rose-700">{notice}</p> : null}
      {editing ? (
        <form className="mt-3 grid gap-3" onSubmit={(event) => event.preventDefault()}>
          <label className="field">
            Name
            <input name="name" required maxLength={80} defaultValue={brand.name} />
          </label>
          <label className="field">
            Link (optional)
            <input
              name="href"
              type="url"
              placeholder="https://"
              pattern="https://.*"
              defaultValue={brand.href ?? ''}
            />
          </label>
          <div className="flex flex-wrap gap-3">
            <ActionButton
              className={deskPrimary}
              checkForm
              busy="Saving…"
              done="Saved"
              surface={deskSurface}
              onRun={async (form) => {
                try {
                  const result = await save({
                    data: {
                      id: brand.id,
                      name: String(form.get('name') ?? ''),
                      href: String(form.get('href') ?? ''),
                    },
                  })
                  if (result.ok) {
                    setEditing(false)
                    await router.invalidate()
                  }
                  return asRun(result, 'Saved.')
                } catch (error) {
                  return failed(error)
                }
              }}
            >
              Save
            </ActionButton>
            <ConfirmDelete
              className={deskDanger}
              onConfirm={() => {
                void remove({ data: { id: brand.id } }).then(async (result) => {
                  setNotice(result.ok ? null : result.error)
                  if (result.ok) await router.invalidate()
                })
              }}
            >
              Delete brand
            </ConfirmDelete>
          </div>
        </form>
      ) : null}
    </li>
  )
}

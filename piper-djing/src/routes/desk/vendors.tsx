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
  deleteCategory,
  deleteVendor,
  getDeskVendors,
  renameCategory,
  saveNewVendor,
  saveNewVendorCategory,
  saveVendor,
  shiftCategory,
  shiftVendor,
  showVendor,
} from '../../lib/crm/vendors.functions.ts'
import type { DeskVendor, DeskVendorCategory } from '../../lib/crm/vendors.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/vendors')({
  // Private page: its data loading rides in the same lazy chunk as its
  // screen, so the server calls it imports stay off the public pages.
  codeSplitGroupings: [['loader', 'component']],
  head: () => deskHead('Vendors · DJ Piper P'),
  loader: () => getDeskVendors(),
  component: VendorsPage,
})

type Result = { ok: true } | { ok: false; error: string }

const LOGO_BOX = { width: 600, height: 300 }
const LOGO_MAX_BYTES = 200_000

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      reject(new Error('Use a PNG, JPEG, or WebP logo.'))
      return
    }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That logo did not load. Try a PNG or JPEG.'))
    }
    image.src = url
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('That logo did not load.'))
    reader.readAsDataURL(blob)
  })
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Shrinks a logo to fit 600 × 300 and compresses it, keeping transparency. */
async function shrinkLogo(file: File): Promise<string> {
  const image = await loadImage(file)
  const scale = Math.min(
    1,
    LOGO_BOX.width / image.naturalWidth,
    LOGO_BOX.height / image.naturalHeight,
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('That logo did not load.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  for (const quality of [0.85, 0.7, 0.55]) {
    const webp = await canvasBlob(canvas, 'image/webp', quality)
    if (webp && webp.type === 'image/webp' && webp.size <= LOGO_MAX_BYTES) {
      return blobToDataUrl(webp)
    }
  }
  // Browsers that can't write WebP: PNG keeps transparency.
  const png = await canvasBlob(canvas, 'image/png', 1)
  if (png && png.size <= LOGO_MAX_BYTES) return blobToDataUrl(png)
  throw new Error('That logo is too detailed to shrink. Try a simpler image.')
}

function pickedFile(form: HTMLFormElement | null, name: string): File | undefined {
  const input = form?.elements.namedItem(name)
  return input instanceof HTMLInputElement ? input.files?.[0] : undefined
}

function asRun(result: Result, done: string): RunResult {
  return result.ok ? { ok: true, message: done } : { ok: false, message: result.error }
}

function VendorsPage() {
  const categories = Route.useLoaderData()
  const router = useRouter()
  const addVendor = useServerFn(saveNewVendor)
  const addCategory = useServerFn(saveNewVendorCategory)
  const [shown, setShown] = useState(true)
  const vendorCount = categories.reduce((sum, category) => sum + category.vendors.length, 0)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Website" title="Vendors">
        <p>
          {'Shown on '}
          <a href="/wedding-vendors" target="_blank" rel="noopener" className="underline">
            /wedding-vendors
          </a>
          {'. Changes are live as soon as you save. Empty categories stay hidden.'}
        </p>
      </DeskTitle>

      <form className={`${deskCard} grid gap-3`} onSubmit={(event) => event.preventDefault()}>
        <h2 className={deskH2}>Add a vendor</h2>
        <label className="field">
          Name
          <input name="name" required maxLength={80} />
        </label>
        <label className="field">
          Category
          <select name="categoryId" required defaultValue={categories[0]?.id ?? ''}>
            {categories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.name}
              </option>
            ))}
          </select>
        </label>
        <label className="field">
          Website
          <input name="href" type="url" required placeholder="https://" pattern="https://.*" />
        </label>
        <label className="field">
          Logo (optional)
          <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
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
              const file = pickedFile(element, 'logo')
              const logo = file ? await shrinkLogo(file) : ''
              const result = await addVendor({
                data: {
                  name: String(form.get('name') ?? ''),
                  categoryId: Number(form.get('categoryId')),
                  href: String(form.get('href') ?? ''),
                  logo,
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
              return { ok: false, message: error instanceof Error ? error.message : 'That did not save.' }
            }
          }}
        >
          Add the vendor
        </ActionButton>
      </form>

      {vendorCount === 0 ? (
        <p className="rounded-xl border border-dashed border-[#d6cce8] p-6 text-center text-sm text-[#4a4262]">
          No vendors yet. The public page shows just its heading and intro until you add one.
        </p>
      ) : null}

      {categories.map((category, index) => (
        <CategoryCard
          key={category.id}
          category={category}
          categories={categories}
          first={index === 0}
          last={index === categories.length - 1}
        />
      ))}

      <form className={`${deskCard} grid gap-3`} onSubmit={(event) => event.preventDefault()}>
        <h2 className={deskH2}>Add a category</h2>
        <label className="field">
          Category name
          <input name="name" required maxLength={80} />
        </label>
        <ActionButton
          className={`${deskPrimary} w-fit`}
          checkForm
          busy="Saving…"
          done="Added"
          surface={deskSurface}
          onRun={async (form, element) => {
            const result = await addCategory({ data: { name: String(form.get('name') ?? '') } })
            if (result.ok) {
              element?.reset()
              await router.invalidate()
            }
            return asRun(result, 'Added.')
          }}
        >
          Add the category
        </ActionButton>
      </form>
    </div>
  )
}

function MoveButtons({
  first,
  last,
  label,
  onMove,
}: {
  first: boolean
  last: boolean
  label: string
  onMove: (direction: 'up' | 'down') => Promise<void>
}) {
  const [busy, setBusy] = useState(false)
  const move = (direction: 'up' | 'down') => {
    setBusy(true)
    void onMove(direction).finally(() => setBusy(false))
  }
  const button =
    'inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-[#d6cce8] bg-white text-lg font-semibold text-[#1c1533] transition hover:border-[#ff007f] disabled:opacity-30'
  return (
    <div className="flex gap-1">
      <button
        type="button"
        className={button}
        disabled={first || busy}
        aria-label={`Move ${label} up`}
        onClick={() => move('up')}
      >
        ↑
      </button>
      <button
        type="button"
        className={button}
        disabled={last || busy}
        aria-label={`Move ${label} down`}
        onClick={() => move('down')}
      >
        ↓
      </button>
    </div>
  )
}

function CategoryCard({
  category,
  categories,
  first,
  last,
}: {
  category: DeskVendorCategory
  categories: DeskVendorCategory[]
  first: boolean
  last: boolean
}) {
  const router = useRouter()
  const rename = useServerFn(renameCategory)
  const remove = useServerFn(deleteCategory)
  const shift = useServerFn(shiftCategory)
  const [notice, setNotice] = useState<string | null>(null)
  const visible = category.vendors.filter((vendor) => vendor.shown).length

  return (
    <section className={`${deskCard} grid gap-4`}>
      <form className="grid gap-3" onSubmit={(event) => event.preventDefault()}>
        <div className="flex flex-wrap items-end gap-3">
          <label className="field min-w-0 flex-1">
            Category
            <input name="name" required maxLength={80} defaultValue={category.name} />
          </label>
          <MoveButtons
            first={first}
            last={last}
            label={category.name}
            onMove={async (direction) => {
              const result = await shift({ data: { id: category.id, direction } })
              if (!result.ok) setNotice(result.error)
              await router.invalidate()
            }}
          />
        </div>
        <p className="text-sm text-[#4a4262]">
          {category.vendors.length === 0
            ? 'No vendors yet · hidden on the site'
            : `${category.vendors.length} ${category.vendors.length === 1 ? 'vendor' : 'vendors'} · ${visible} shown${visible === 0 ? ' · hidden on the site' : ''}`}
        </p>
        <div className="flex flex-wrap gap-3">
          <ActionButton
            className={deskGhost}
            checkForm
            busy="Saving…"
            done="Renamed"
            surface={deskSurface}
            onRun={async (form) => {
              const result = await rename({
                data: { id: category.id, name: String(form.get('name') ?? '') },
              })
              if (result.ok) await router.invalidate()
              return asRun(result, 'Renamed.')
            }}
          >
            Rename
          </ActionButton>
          <ConfirmDelete
            className={deskDanger}
            onConfirm={() => {
              void remove({ data: { id: category.id } }).then(async (result) => {
                setNotice(result.ok ? null : result.error)
                if (result.ok) await router.invalidate()
              })
            }}
          >
            Delete category
          </ConfirmDelete>
        </div>
        {notice ? <p className="text-sm text-rose-700">{notice}</p> : null}
      </form>
      {category.vendors.length > 0 ? (
        <ul className="grid gap-2">
          {category.vendors.map((vendor, index) => (
            <VendorRow
              key={vendor.id}
              vendor={vendor}
              categories={categories}
              first={index === 0}
              last={index === category.vendors.length - 1}
            />
          ))}
        </ul>
      ) : null}
    </section>
  )
}

function VendorRow({
  vendor,
  categories,
  first,
  last,
}: {
  vendor: DeskVendor
  categories: DeskVendorCategory[]
  first: boolean
  last: boolean
}) {
  const router = useRouter()
  const save = useServerFn(saveVendor)
  const remove = useServerFn(deleteVendor)
  const show = useServerFn(showVendor)
  const shift = useServerFn(shiftVendor)
  const [editing, setEditing] = useState(false)
  const [shown, setShown] = useState(vendor.shown)
  const [removeLogo, setRemoveLogo] = useState(false)
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <li className="rounded-xl border border-[#e6def4] bg-[#faf8fd] p-3">
      <div className="flex flex-wrap items-center gap-3">
        <span className="flex h-12 w-20 shrink-0 items-center justify-center rounded-lg border border-[#e6def4] bg-white p-1">
          {vendor.logo ? (
            <img src={vendor.logo} alt="" className="max-h-10 max-w-full object-contain" />
          ) : (
            <span className="text-[10px] font-semibold text-[#4a4262]">No logo</span>
          )}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate font-semibold">{vendor.name}</p>
          <a
            href={vendor.href}
            target="_blank"
            rel="noopener"
            className="block truncate text-sm text-[#d1006b] underline"
          >
            {vendor.href}
          </a>
        </div>
        <MoveButtons
          first={first}
          last={last}
          label={vendor.name}
          onMove={async (direction) => {
            const result = await shift({ data: { id: vendor.id, direction } })
            if (!result.ok) setNotice(result.error)
            await router.invalidate()
          }}
        />
      </div>
      <div className="mt-3 flex flex-wrap items-center gap-4">
        <ShowSwitch
          checked={shown}
          onChange={(next) => {
            setShown(next)
            void show({ data: { id: vendor.id, shown: next } }).then(async (result) => {
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
            <input name="name" required maxLength={80} defaultValue={vendor.name} />
          </label>
          <label className="field">
            Category
            <select name="categoryId" defaultValue={vendor.categoryId}>
              {categories.map((category) => (
                <option key={category.id} value={category.id}>
                  {category.name}
                </option>
              ))}
            </select>
          </label>
          <label className="field">
            Website
            <input
              name="href"
              type="url"
              required
              pattern="https://.*"
              defaultValue={vendor.href}
            />
          </label>
          <label className="field">
            {vendor.logo ? 'Replace logo' : 'Logo'}
            <input name="logo" type="file" accept="image/png,image/jpeg,image/webp" />
          </label>
          {vendor.logo ? (
            <label className="flex items-center gap-2 text-sm font-semibold">
              <input
                type="checkbox"
                checked={removeLogo}
                onChange={(event) => setRemoveLogo(event.target.checked)}
              />
              Remove the logo (show a name card)
            </label>
          ) : null}
          <div className="flex flex-wrap gap-3">
            <ActionButton
              className={deskPrimary}
              checkForm
              busy="Saving…"
              done="Saved"
              surface={deskSurface}
              onRun={async (form, element) => {
                try {
                  const file = pickedFile(element, 'logo')
                  const logo = file ? await shrinkLogo(file) : ''
                  const result = await save({
                    data: {
                      id: vendor.id,
                      name: String(form.get('name') ?? ''),
                      categoryId: Number(form.get('categoryId')),
                      href: String(form.get('href') ?? ''),
                      logo,
                      removeLogo,
                    },
                  })
                  if (result.ok) {
                    setRemoveLogo(false)
                    setEditing(false)
                    await router.invalidate()
                  }
                  return asRun(result, 'Saved.')
                } catch (error) {
                  return {
                    ok: false,
                    message: error instanceof Error ? error.message : 'That did not save.',
                  }
                }
              }}
            >
              Save
            </ActionButton>
            <ConfirmDelete
              className={deskDanger}
              onConfirm={() => {
                void remove({ data: { id: vendor.id } }).then(async (result) => {
                  setNotice(result.ok ? null : result.error)
                  if (result.ok) await router.invalidate()
                })
              }}
            >
              Delete vendor
            </ConfirmDelete>
          </div>
        </form>
      ) : null}
    </li>
  )
}

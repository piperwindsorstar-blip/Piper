import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import { DeskTitle, deskCard, deskPrimary } from '../../components/desk-ui.tsx'
import {
  deletePartner,
  getPartners,
  savePartner,
} from '../../lib/crm/desk.functions.ts'
import { deskHead } from '../../lib/desk-head.ts'

export const Route = createFileRoute('/desk/partners')({
  head: () => deskHead('Partners · Piper DJing'),
  loader: () => getPartners(),
  component: PartnersPage,
})

function readLogo(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!['image/png', 'image/jpeg', 'image/webp'].includes(file.type)) {
      reject(new Error('Use a PNG, JPEG, or WebP logo.'))
      return
    }
    if (file.size > 200_000) {
      reject(new Error('That logo is too large. Keep it under 200 KB.'))
      return
    }
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('That logo did not load.'))
    reader.readAsDataURL(file)
  })
}

function PartnersPage() {
  const partners = Route.useLoaderData()
  const save = useServerFn(savePartner)
  const remove = useServerFn(deletePartner)
  const router = useRouter()
  const [notice, setNotice] = useState<string | null>(null)

  return (
    <div className="grid gap-5">
      <DeskTitle kicker="Partners" title="Partner brands">
        <p className="mt-1 text-sm text-white/65">
          Each logo is a small link on the wedding page. Four fit across a
          phone. Add or remove them here.
        </p>
      </DeskTitle>
      <form
        className={`${deskCard} grid gap-3`}
        onSubmit={(event) => {
          event.preventDefault()
          const form = event.currentTarget
          const name = String(new FormData(form).get('name') ?? '')
          const href = String(new FormData(form).get('href') ?? '')
          const file = form.elements.namedItem('logo')
          const logo =
            file instanceof HTMLInputElement ? file.files?.[0] : undefined
          if (!logo) {
            setNotice('Choose a logo.')
            return
          }
          void readLogo(logo)
            .then((data) => save({ data: { name, href, logo: data } }))
            .then(async (result) => {
              setNotice(result.ok ? 'Added.' : result.error)
              if (result.ok) {
                form.reset()
                await router.invalidate()
              }
            })
            .catch((error: unknown) => {
              setNotice(
                error instanceof Error
                  ? error.message
                  : 'That logo did not load.',
              )
            })
        }}
      >
        <label className="field">
          Brand name
          <input name="name" required />
        </label>
        <label className="field">
          Website
          <input name="href" type="url" required placeholder="https://" />
        </label>
        <label className="field">
          Logo
          <input
            name="logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            required
          />
        </label>
        <button type="submit" className={`${deskPrimary} w-fit`}>
          Add the brand
        </button>
      </form>
      {notice ? <p className="text-sm text-white/85">{notice}</p> : null}
      {partners.length === 0 ? (
        <p className="rounded-xl border border-dashed border-white/15 p-8 text-center text-sm text-white/65">
          No partner brands yet. The wedding page section stays hidden.
        </p>
      ) : (
        <ul className="grid gap-2">
          {partners.map((partner) => (
            <li
              key={partner.id}
              className="flex items-center gap-4 rounded-xl border border-white/10 bg-ink-900 px-4 py-3"
            >
              <img
                src={partner.src}
                alt=""
                className="size-14 rounded-2xl border border-white/10 bg-ink-950 object-contain p-1"
              />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl font-bold tracking-tight">
                  {partner.name}
                </p>
                <a
                  href={partner.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm text-hot underline"
                >
                  {partner.href}
                </a>
              </div>
              <button
                type="button"
                className="min-h-11 shrink-0 text-sm font-semibold text-rose-300"
                onClick={() => {
                  void remove({ data: { id: partner.id } }).then(
                    async (result) => {
                      setNotice(result.ok ? 'Removed.' : result.error)
                      if (result.ok) await router.invalidate()
                    },
                  )
                }}
              >
                Remove
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

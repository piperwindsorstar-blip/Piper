import { createFileRoute, useRouter } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import { useState } from 'react'
import {
  deletePartner,
  getPartners,
  savePartner,
} from '../../lib/crm/desk.functions.ts'
import { privateHead } from '../../lib/seo.ts'

export const Route = createFileRoute('/desk/partners')({
  head: () => privateHead('Partners · Piper DJing'),
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
    <div className="grid max-w-xl gap-6">
      <h1 className="font-display text-4xl tracking-tight">Partner brands</h1>
      <p className="text-sm text-muted">
        Each logo is a small link on the homepage. Four fit across a phone. Add
        or remove them here.
      </p>
      <form
        className="grid gap-3"
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
              if (!result) return
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
        <button
          type="submit"
          className="min-h-11 w-fit rounded-full bg-ink px-5 text-sm text-ivory"
        >
          Add the brand
        </button>
      </form>
      {notice ? <p className="text-sm">{notice}</p> : null}
      {partners.length === 0 ? (
        <p className="text-sm text-muted">
          No partner brands yet. The homepage section stays hidden.
        </p>
      ) : (
        <ul className="grid gap-3">
          {partners.map((partner) => (
            <li
              key={partner.id}
              className="flex items-center gap-4 rounded-card border border-line bg-ivory px-4 py-3"
            >
              <img
                src={partner.src}
                alt=""
                className="size-14 rounded-2xl border border-line bg-paper object-contain p-1"
              />
              <div className="min-w-0 flex-1">
                <p className="font-display text-xl tracking-tight">
                  {partner.name}
                </p>
                <a
                  href={partner.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="block truncate text-sm text-muted underline"
                >
                  {partner.href}
                </a>
              </div>
              <button
                type="button"
                className="min-h-11 shrink-0 text-sm text-danger"
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

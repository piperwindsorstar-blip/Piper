import { Outlet, createFileRoute, useRouter } from '@tanstack/react-router'
import { useState } from 'react'
import { useServerFn } from '@tanstack/react-start'
import { PortalChrome } from '../../components/portal/portal-chrome.tsx'
import { PortalProvider } from '../../components/portal/portal-state.tsx'
import type { PortalPage } from '../../components/portal/portal-state.tsx'
import {
  getPortal,
  openPortalPasscode,
} from '../../lib/portal/portal.functions.ts'
import { privateHead } from '../../lib/seo.ts'

const FONTS =
  'https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=Inter+Display:wght@800;900&display=swap'

export const Route = createFileRoute('/portal')({
  head: () => {
    const head = privateHead('Your plan · DJ Piper P')
    return {
      ...head,
      links: [{ rel: 'stylesheet', href: FONTS }],
    }
  },
  loader: () => getPortal(),
  component: PortalLayout,
})

function PortalLayout() {
  const page = Route.useLoaderData()
  if (!page) return <PasscodeGate />
  return (
    <PortalProvider page={toPage(page)}>
      <PortalChrome>
        <Outlet />
      </PortalChrome>
    </PortalProvider>
  )
}

function toPage(
  page: NonNullable<Awaited<ReturnType<typeof getPortal>>>,
): PortalPage {
  return {
    partnerOne: page.partnerOne,
    partnerTwo: page.partnerTwo,
    eventDate: page.eventDate,
    packageName: page.packageName,
    venueName: page.venueName,
    invoiceSlug: page.invoiceSlug,
    slug: page.slug,
    today: page.today,
    locked: page.locked,
    planning: page.planning,
    master: page.master,
  }
}

function PasscodeGate() {
  const open = useServerFn(openPortalPasscode)
  const router = useRouter()
  const [code, setCode] = useState('')
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  return (
    <main className="portal px-6 py-24">
      <h1 className="portal-display text-[32px] leading-[1.02] min-[1024px]:text-5xl">
        This page opens from the link Piper sent you.
      </h1>
      <form
        className="mt-8 max-w-md"
        onSubmit={(event) => {
          event.preventDefault()
          setBusy(true)
          setError('')
          void open({ data: { passcode: code } }).then(async (result) => {
            if (!result.ok) {
              setError(result.error)
              setBusy(false)
              return
            }
            await router.invalidate()
          })
        }}
      >
        <label className="grid gap-2 text-sm text-[var(--text-muted)]">
          Have a passcode from Piper?
          <input
            className="portal-input"
            value={code}
            autoComplete="off"
            spellCheck={false}
            onChange={(event) => setCode(event.target.value)}
          />
        </label>
        <button
          type="submit"
          className="mt-4 min-h-[54px] w-full rounded-full bg-[var(--pink)] text-base font-bold text-[#0d0d0d]"
          disabled={busy || code.trim() === ''}
        >
          Open the plan
        </button>
        {error ? (
          <p className="mt-3 text-sm text-[var(--pink-soft)]">{error}</p>
        ) : null}
      </form>
    </main>
  )
}

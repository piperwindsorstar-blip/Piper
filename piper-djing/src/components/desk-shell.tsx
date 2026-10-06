import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import type { ReactNode } from 'react'

import { signOut } from '../lib/auth/server.ts'

const LINKS = [
  ['/desk', 'Overview'],
  ['/desk/bookings', 'Bookings'],
  ['/desk/invoices', 'Invoices'],
  ['/desk/payments', 'Payments'],
  ['/desk/leads', 'Leads'],
  ['/desk/packages', 'Packages'],
  ['/desk/terms', 'Terms'],
  ['/desk/questions', 'Questions'],
  ['/desk/media', 'Media'],
  ['/desk/bots', 'Bots'],
  ['/desk/settings', 'Settings'],
] as const

export function DeskShell({ children }: { children: ReactNode }) {
  const pathname = useRouterState({ select: (state) => state.location.pathname })
  const router = useRouter()
  const out = useServerFn(signOut)

  return (
    <div className="min-h-screen">
      <header className="border-b border-line bg-paper">
        <div className="mx-auto flex w-full max-w-6xl items-center justify-between gap-4 px-5 py-4">
          <p className="font-display text-xl tracking-tight">Piper desk</p>
          <button
            type="button"
            className="text-sm text-muted"
            onClick={() => {
              void out({ data: {} }).then(async () => {
                await router.navigate({ to: '/login' })
              })
            }}
          >
            Sign out
          </button>
        </div>
        <nav className="mx-auto flex w-full max-w-6xl gap-2 overflow-x-auto px-5 pb-4">
          {LINKS.map(([to, label]) => {
            const active = to === '/desk' ? pathname === '/desk' || pathname === '/desk/' : pathname === to
            return (
              <Link
                key={to}
                to={to}
                className={`inline-flex min-h-11 shrink-0 items-center rounded-full px-4 text-sm ${
                  active ? 'bg-ink text-ivory' : 'border border-line bg-ivory text-ink'
                }`}
              >
                {label}
              </Link>
            )
          })}
        </nav>
      </header>
      <main className="mx-auto w-full max-w-6xl px-5 py-8">{children}</main>
    </div>
  )
}

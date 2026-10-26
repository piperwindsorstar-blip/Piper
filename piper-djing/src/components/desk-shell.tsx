import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  Calendar,
  ExternalLink,
  House,
  LogOut,
  Mail,
  Menu,
  Search,
  Wallet,
  X,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { signOut } from '../lib/auth/server.ts'
import { todayInToronto } from '../lib/crm/date-request.ts'
import { attention, channelMeter } from '../lib/desk-console.ts'
import type {
  ConsoleBooking,
  ConsoleLead,
  ConsolePlan,
  ConsoleReview,
} from '../lib/desk-console.ts'

type MainPath = '/desk' | '/desk/leads' | '/desk/bookings' | '/desk/money'

type SmallPath =
  | '/desk/portals'
  | '/desk/songs'
  | '/desk/rsvp'
  | '/desk/packages'
  | '/desk/terms'
  | '/desk/questions'
  | '/desk/reviews'
  | '/desk/media'
  | '/desk/vendors'
  | '/desk/brands'
  | '/desk/bots'
  | '/desk/settings'

const ICONS = { home: House, mail: Mail, calendar: Calendar, wallet: Wallet } as const

/** The four places Piper goes every day. Everything else is a small link. */
const MAIN: { name: string; to: MainPath; icon: keyof typeof ICONS }[] = [
  { name: 'Overview', to: '/desk', icon: 'home' },
  { name: 'Leads', to: '/desk/leads', icon: 'mail' },
  { name: 'Bookings', to: '/desk/bookings', icon: 'calendar' },
  { name: 'Money', to: '/desk/money', icon: 'wallet' },
]

const SMALL: { name: string; links: { name: string; to: SmallPath }[] }[] = [
  {
    name: 'Couples',
    links: [
      { name: 'Portals', to: '/desk/portals' },
      { name: 'Songs', to: '/desk/songs' },
      { name: 'RSVP', to: '/desk/rsvp' },
    ],
  },
  {
    name: 'Your offer',
    links: [
      { name: 'Packages', to: '/desk/packages' },
      { name: 'Terms', to: '/desk/terms' },
      { name: 'Questions', to: '/desk/questions' },
    ],
  },
  {
    name: 'Website',
    links: [
      { name: 'Reviews', to: '/desk/reviews' },
      { name: 'Media', to: '/desk/media' },
      { name: 'Vendors', to: '/desk/vendors' },
      { name: 'Brands', to: '/desk/brands' },
    ],
  },
  {
    name: 'System',
    links: [
      { name: 'Bots', to: '/desk/bots' },
      { name: 'Settings', to: '/desk/settings' },
    ],
  },
]

export type DeskConsoleData = {
  overview: { totalCents: number }
  bookings: ConsoleBooking[]
  leads: ConsoleLead[]
  externalDates: { eventDate: string; released: boolean }[]
  questions: unknown[]
  media: unknown[]
  reviews: ConsoleReview[]
  bots: unknown[]
  plans?: ConsolePlan[]
}

function activePath(pathname: string, to: string) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (to === '/desk') return path === '/desk'
  // The old Invoices and Payments addresses now open Money.
  if (to === '/desk/money' && (path === '/desk/invoices' || path === '/desk/payments')) return true
  return path === to || path.startsWith(`${to}/`)
}

export function DeskShell({
  data,
  children,
}: {
  data: DeskConsoleData
  children: ReactNode
}) {
  const pathname = useRouterState({
    select: (state) => state.location.pathname,
  })
  const router = useRouter()
  const out = useServerFn(signOut)
  const [menuOpen, setMenuOpen] = useState(false)
  const today = todayInToronto()
  const meterInput = {
    bookings: data.bookings,
    leads: data.leads,
    questions: data.questions.length,
    media: data.media.length,
    reviews: data.reviews,
    bots: data.bots.length,
    totalCents: data.overview.totalCents,
  }
  const waiting = attention(data.bookings, data.leads, today, data.plans ?? []).length

  /** A small count beside a section: things that need Piper there. */
  function badge(name: string): number {
    if (name === 'Overview') return waiting
    if (name === 'Leads' || name === 'Reviews') {
      return channelMeter(name, meterInput, today).badge
    }
    if (name === 'Money') return channelMeter('Invoices', meterInput, today).badge
    return 0
  }

  useEffect(() => {
    setMenuOpen(false)
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  useEffect(() => {
    if (!menuOpen) return
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [menuOpen])

  const signOutNow = () => {
    void out({ data: {} }).then(async () => {
      await router.navigate({ to: '/login' })
    })
  }

  const current =
    [...MAIN, ...SMALL.flatMap((group) => group.links)].find((item) =>
      activePath(pathname, item.to),
    )?.name ?? 'Desk'

  return (
    <div className="desk min-h-screen min-w-0 lg:grid lg:grid-cols-[16.25rem_minmax(0,1fr)]">
      <a
        href="#desk-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* Computer: the four daily places up top, the rest as small links. */}
      <aside className="desk-header sticky top-0 hidden h-screen flex-col gap-5 overflow-y-auto px-3.5 py-5 lg:flex">
        <Brand />
        <FindButton />
        <MainNav pathname={pathname} badge={badge} />
        <SmallNav pathname={pathname} badge={badge} />
        <FooterLinks onSignOut={signOutNow} />
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Phone and tablet: a slim ink bar with the logo, the page and search. */}
        <header className="desk-header sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-2 pt-[max(0.5rem,env(safe-area-inset-top))] lg:hidden">
          <Link to="/desk" className="flex items-center gap-2" aria-label="Desk overview">
            <img src="/brand/dj-piper-p.png" alt="" className="h-9 w-auto" />
          </Link>
          <p className="min-w-0 truncate font-display text-lg font-extrabold tracking-tight">
            {current}
          </p>
          <Link
            to="/desk/bookings"
            search={{ find: true }}
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg border border-white/15 text-[#fff] hover:bg-white/10"
            aria-label="Find a couple or venue"
          >
            <Search className="h-5 w-5" aria-hidden="true" />
          </Link>
        </header>

        <main
          id="desk-main"
          className="mx-auto w-full max-w-[76rem] min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-12 lg:pt-10 lg:pb-16"
        >
          {children}
        </main>
      </div>

      {/* Phone: the four daily places, plus More for the rest. */}
      <nav
        aria-label="Quick sections"
        className="desk-header fixed inset-x-0 bottom-0 z-30 pb-[max(0.5rem,env(safe-area-inset-bottom))] lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5 gap-0.5 px-2 pt-2">
          {MAIN.map((item) => {
            const Icon = ICONS[item.icon]
            const on = activePath(pathname, item.to)
            const count = badge(item.name)
            return (
              <li key={item.name}>
                <Link
                  to={item.to}
                  aria-current={on ? 'page' : undefined}
                  className={`flex min-h-13 flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] ${
                    on ? 'bg-[#ff007f] font-bold text-[#1c1533]' : 'font-semibold text-[#e4ddf3]'
                  }`}
                >
                  <span className="relative">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                    {count > 0 ? <Count n={count} floating /> : null}
                  </span>
                  {item.name}
                </Link>
              </li>
            )
          })}
          <li>
            <button
              type="button"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="flex min-h-13 w-full flex-col items-center justify-center gap-0.5 rounded-xl text-[11px] font-semibold text-[#e4ddf3]"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* Phone menu: every section, in a sheet. */}
      {menuOpen ? (
        <div
          className="fixed inset-0 z-40 lg:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Desk menu"
        >
          <button
            type="button"
            aria-label="Close the menu"
            className="absolute inset-0 bg-black/50"
            onClick={() => setMenuOpen(false)}
          />
          <div className="desk-header absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col gap-5 overflow-y-auto px-3.5 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
            <div className="flex items-center justify-between">
              <Brand />
              <button
                type="button"
                className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/85 hover:bg-white/10"
                aria-label="Close the menu"
                onClick={() => setMenuOpen(false)}
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>
            <MainNav pathname={pathname} badge={badge} />
            <SmallNav pathname={pathname} badge={badge} />
            <FooterLinks onSignOut={signOutNow} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Brand() {
  return (
    <Link to="/desk" className="flex items-center gap-2.5 px-1.5" aria-label="Desk overview">
      <img src="/brand/dj-piper-p.png" alt="" className="h-12 w-auto" />
      <span className="text-xs font-bold tracking-[0.18em] text-[#ff4fa3] uppercase">Desk</span>
    </Link>
  )
}

function FindButton() {
  return (
    <Link
      to="/desk/bookings"
      search={{ find: true }}
      className="flex min-h-11 items-center gap-2.5 rounded-xl border border-[#3a2f5c] bg-[#251c42] px-3 text-sm text-[#c9bfe0] hover:border-[#5a4c86] hover:text-white"
    >
      <Search className="h-4.5 w-4.5" aria-hidden="true" />
      Find a couple or venue
    </Link>
  )
}

function MainNav({
  pathname,
  badge,
}: {
  pathname: string
  badge: (name: string) => number
}) {
  return (
    <nav aria-label="Desk" >
      <ul className="grid gap-1">
        {MAIN.map((item) => {
          const Icon = ICONS[item.icon]
          const on = activePath(pathname, item.to)
          const count = badge(item.name)
          return (
            <li key={item.name}>
              <Link
                to={item.to}
                aria-current={on ? 'page' : undefined}
                className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-[15px] transition ${
                  on
                    ? 'bg-[#ff007f] font-bold text-[#1c1533]'
                    : 'font-medium text-[#e4ddf3] hover:bg-white/8 hover:text-white'
                }`}
              >
                <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                <span className="flex-1">{item.name}</span>
                {count > 0 ? <Count n={count} dark={on} /> : null}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

function SmallNav({
  pathname,
  badge,
}: {
  pathname: string
  badge: (name: string) => number
}) {
  return (
    <nav aria-label="More of the desk" className="grid flex-1 content-start gap-3.5 border-t border-white/10 pt-4">
      {SMALL.map((group) => (
        <div key={group.name}>
          <p className="px-2 text-[11px] font-semibold tracking-[0.12em] text-[#a99cc4] uppercase">
            {group.name}
          </p>
          <ul className="mt-1 flex flex-wrap gap-x-1 gap-y-0.5">
            {group.links.map((item) => {
              const on = activePath(pathname, item.to)
              const count = badge(item.name)
              return (
                <li key={item.name}>
                  <Link
                    to={item.to}
                    aria-current={on ? 'page' : undefined}
                    className={`inline-flex min-h-9 items-center gap-1.5 rounded-lg px-2 text-sm ${
                      on
                        ? 'bg-white/12 font-semibold text-white shadow-[inset_0_-2px_0_#ff007f]'
                        : 'text-[#e4ddf3] hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    {item.name}
                    {count > 0 ? <Count n={count} /> : null}
                  </Link>
                </li>
              )
            })}
          </ul>
        </div>
      ))}
    </nav>
  )
}

function FooterLinks({ onSignOut }: { onSignOut: () => void }) {
  return (
    <div className="flex flex-wrap items-center justify-between gap-1 border-t border-white/10 pt-3">
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-sm text-[#cfc6e6] hover:bg-white/8 hover:text-white"
      >
        <ExternalLink className="h-4 w-4" aria-hidden="true" />
        View the website
      </a>
      <button
        type="button"
        onClick={onSignOut}
        className="inline-flex min-h-10 items-center gap-2 rounded-lg px-2 text-left text-sm text-[#cfc6e6] hover:bg-white/8 hover:text-white"
      >
        <LogOut className="h-4 w-4" aria-hidden="true" />
        Sign out
      </button>
    </div>
  )
}

function Count({
  n,
  floating = false,
  dark = false,
}: {
  n: number
  floating?: boolean
  dark?: boolean
}) {
  return (
    <span
      className={`grid h-5 min-w-5 place-items-center rounded-full px-1.5 text-[11px] font-bold ${
        dark ? 'bg-[#1c1533] text-white' : 'bg-[#ff007f] text-[#1c1533]'
      } ${floating ? 'absolute -top-1.5 -right-3' : ''}`}
      aria-label={`${n} waiting`}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

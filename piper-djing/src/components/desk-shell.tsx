import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  Box,
  Calendar,
  CircleQuestionMark,
  Cpu,
  ExternalLink,
  FileText,
  House,
  Image,
  List,
  Lock,
  LogOut,
  Mail,
  Menu,
  SlidersHorizontal,
  Star,
  Ticket,
  Users,
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
  ConsoleReview,
} from '../lib/desk-console.ts'

const ICONS = {
  home: House,
  mail: Mail,
  calendar: Calendar,
  file: FileText,
  wallet: Wallet,
  box: Box,
  list: List,
  help: CircleQuestionMark,
  star: Star,
  image: Image,
  users: Users,
  cpu: Cpu,
  sliders: SlidersHorizontal,
  lock: Lock,
  ticket: Ticket,
} as const

type DeskPath =
  | '/desk'
  | '/desk/leads'
  | '/desk/bookings'
  | '/desk/invoices'
  | '/desk/payments'
  | '/desk/portals'
  | '/desk/rsvp'
  | '/desk/packages'
  | '/desk/terms'
  | '/desk/questions'
  | '/desk/reviews'
  | '/desk/media'
  | '/desk/partners'
  | '/desk/bots'
  | '/desk/settings'

type Channel = {
  name: string
  to: DeskPath
  icon: keyof typeof ICONS
}

/** The desk's sections, grouped by what Piper is doing, in plain words. */
const GROUPS: { name: string; channels: Channel[] }[] = [
  {
    name: 'Your book',
    channels: [
      { name: 'Overview', to: '/desk', icon: 'home' },
      { name: 'Leads', to: '/desk/leads', icon: 'mail' },
      { name: 'Bookings', to: '/desk/bookings', icon: 'calendar' },
      { name: 'Invoices', to: '/desk/invoices', icon: 'file' },
      { name: 'Payments', to: '/desk/payments', icon: 'wallet' },
    ],
  },
  {
    name: 'Couples',
    channels: [
      { name: 'Portals', to: '/desk/portals', icon: 'lock' },
      { name: 'RSVP', to: '/desk/rsvp', icon: 'ticket' },
    ],
  },
  {
    name: 'Your offer',
    channels: [
      { name: 'Packages', to: '/desk/packages', icon: 'box' },
      { name: 'Terms', to: '/desk/terms', icon: 'list' },
      { name: 'Questions', to: '/desk/questions', icon: 'help' },
    ],
  },
  {
    name: 'Website',
    channels: [
      { name: 'Reviews', to: '/desk/reviews', icon: 'star' },
      { name: 'Media', to: '/desk/media', icon: 'image' },
      { name: 'Partners', to: '/desk/partners', icon: 'users' },
    ],
  },
  {
    name: 'System',
    channels: [
      { name: 'Bots', to: '/desk/bots', icon: 'cpu' },
      { name: 'Settings', to: '/desk/settings', icon: 'sliders' },
    ],
  },
]

/** The four a phone reaches with one thumb; everything else is under More. */
const TABS = ['Overview', 'Leads', 'Bookings', 'Payments']

export type DeskConsoleData = {
  overview: { totalCents: number }
  bookings: ConsoleBooking[]
  leads: ConsoleLead[]
  externalDates: { eventDate: string; released: boolean }[]
  questions: unknown[]
  media: unknown[]
  partners: unknown[]
  reviews: ConsoleReview[]
  bots: unknown[]
}

function activePath(pathname: string, to: string) {
  const path = pathname.replace(/\/+$/, '') || '/'
  if (to === '/desk') return path === '/desk'
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
    partners: data.partners.length,
    reviews: data.reviews,
    bots: data.bots.length,
    totalCents: data.overview.totalCents,
  }
  const waiting = attention(data.bookings, data.leads, today).length

  /** A small count beside a section: things that need Piper there. */
  function badge(name: string): number {
    if (name === 'Overview') return waiting
    if (name === 'Leads' || name === 'Invoices' || name === 'Reviews') {
      return channelMeter(name, meterInput, today).badge
    }
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
    GROUPS.flatMap((group) => group.channels).find((channel) =>
      activePath(pathname, channel.to),
    )?.name ?? 'Desk'

  return (
    <div className="desk min-h-screen min-w-0 lg:grid lg:grid-cols-[16rem_minmax(0,1fr)]">
      <a
        href="#desk-main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-full focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold"
      >
        Skip to content
      </a>

      {/* Desktop: a calm sidebar with every section in view. */}
      <aside className="desk-header sticky top-0 hidden h-screen flex-col overflow-y-auto px-3 py-5 lg:flex">
        <Brand />
        <SectionNav pathname={pathname} badge={badge} />
        <FooterLinks onSignOut={signOutNow} />
      </aside>

      <div className="flex min-w-0 flex-col">
        {/* Phone and tablet: a slim bar with the page name and a menu. */}
        <header className="desk-header sticky top-0 z-30 flex items-center justify-between gap-3 px-4 py-2.5 pt-[max(0.625rem,env(safe-area-inset-top))] lg:hidden">
          <Link to="/desk" className="flex items-center gap-2" aria-label="Desk overview">
            <img src="/brand/dj-piper-p.png" alt="" className="h-8 w-auto" />
          </Link>
          <p className="min-w-0 truncate text-sm font-semibold">{current}</p>
          <button
            type="button"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-white/85 hover:bg-white/10"
            aria-label="Open the menu"
            aria-expanded={menuOpen}
            onClick={() => setMenuOpen(true)}
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>
        </header>

        <main
          id="desk-main"
          className="mx-auto w-full max-w-5xl min-w-0 flex-1 px-4 pt-5 pb-28 sm:px-6 lg:px-10 lg:pt-8 lg:pb-12"
        >
          {children}
        </main>
      </div>

      {/* Phone: the four busiest sections, plus More for the rest. */}
      <nav
        aria-label="Quick sections"
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[#e3dcf2] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
      >
        <ul className="mx-auto grid max-w-md grid-cols-5">
          {GROUPS.flatMap((group) => group.channels)
            .filter((channel) => TABS.includes(channel.name))
            .map((channel) => {
              const Icon = ICONS[channel.icon]
              const on = activePath(pathname, channel.to)
              const count = badge(channel.name)
              return (
                <li key={channel.name}>
                  <Link
                    to={channel.to}
                    aria-current={on ? 'page' : undefined}
                    className={`flex min-h-14 flex-col items-center justify-center gap-0.5 text-[11px] font-semibold ${on ? 'text-[#d1006b]' : 'text-[#5b5370]'}`}
                  >
                    <span className="relative">
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      {count > 0 ? <Count n={count} floating /> : null}
                    </span>
                    {channel.name}
                  </Link>
                </li>
              )
            })}
          <li>
            <button
              type="button"
              aria-expanded={menuOpen}
              onClick={() => setMenuOpen(true)}
              className="flex min-h-14 w-full flex-col items-center justify-center gap-0.5 text-[11px] font-semibold text-[#5b5370]"
            >
              <Menu className="h-5 w-5" aria-hidden="true" />
              More
            </button>
          </li>
        </ul>
      </nav>

      {/* Phone menu: every section, grouped, in a sheet. */}
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
          <div className="desk-header absolute inset-y-0 right-0 flex w-[min(20rem,88vw)] flex-col overflow-y-auto px-3 pt-[max(1rem,env(safe-area-inset-top))] pb-[max(1rem,env(safe-area-inset-bottom))] shadow-2xl">
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
            <SectionNav pathname={pathname} badge={badge} />
            <FooterLinks onSignOut={signOutNow} />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function Brand() {
  return (
    <Link to="/desk" className="flex items-center gap-3 px-2" aria-label="Desk overview">
      <img src="/brand/dj-piper-p.png" alt="" className="h-10 w-auto" />
      <span className="text-sm font-semibold tracking-wide text-white/75">Desk</span>
    </Link>
  )
}

function SectionNav({
  pathname,
  badge,
}: {
  pathname: string
  badge: (name: string) => number
}) {
  return (
    <nav aria-label="Desk sections" className="mt-6 grid flex-1 content-start gap-5">
      {GROUPS.map((group) => (
        <div key={group.name}>
          <p className="px-3 text-[11px] font-semibold tracking-wider text-white/50 uppercase">
            {group.name}
          </p>
          <ul className="mt-1.5 grid gap-0.5">
            {group.channels.map((channel) => {
              const Icon = ICONS[channel.icon]
              const on = activePath(pathname, channel.to)
              const count = badge(channel.name)
              return (
                <li key={channel.name}>
                  <Link
                    to={channel.to}
                    aria-current={on ? 'page' : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm font-medium transition ${
                      on
                        ? 'bg-white/12 text-white shadow-[inset_3px_0_0_#ff007f]'
                        : 'text-white/75 hover:bg-white/8 hover:text-white'
                    }`}
                  >
                    <Icon
                      className={`h-4.5 w-4.5 shrink-0 ${on ? 'text-[#ff4fa3]' : ''}`}
                      aria-hidden="true"
                    />
                    <span className="flex-1">{channel.name}</span>
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
    <div className="mt-6 grid gap-0.5 border-t border-white/10 pt-4">
      <a
        href="/"
        target="_blank"
        rel="noreferrer"
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-sm text-white/75 hover:bg-white/8 hover:text-white"
      >
        <ExternalLink className="h-4.5 w-4.5" aria-hidden="true" />
        View the website
      </a>
      <button
        type="button"
        onClick={onSignOut}
        className="flex min-h-11 items-center gap-3 rounded-xl px-3 text-left text-sm text-white/75 hover:bg-white/8 hover:text-white"
      >
        <LogOut className="h-4.5 w-4.5" aria-hidden="true" />
        Sign out
      </button>
      <p className="mt-2 flex items-center gap-1.5 px-3 text-xs text-white/50">
        <Lock className="h-3 w-3" aria-hidden="true" />
        Private. Piper only.
      </p>
    </div>
  )
}

function Count({ n, floating = false }: { n: number; floating?: boolean }) {
  return (
    <span
      className={`grid h-5 min-w-5 place-items-center rounded-full bg-[#ff007f] px-1.5 text-[11px] font-bold text-white ${
        floating ? 'absolute -top-1.5 -right-3' : ''
      }`}
      aria-label={`${n} waiting`}
    >
      {n > 99 ? '99+' : n}
    </span>
  )
}

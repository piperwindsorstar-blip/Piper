import { Link, useRouter, useRouterState } from '@tanstack/react-router'
import { useServerFn } from '@tanstack/react-start'
import {
  Box,
  Calendar,
  CircleQuestionMark,
  Cpu,
  FileText,
  House,
  Image,
  List,
  Lock,
  Mail,
  SlidersHorizontal,
  Star,
  Users,
  Wallet,
} from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ReactNode } from 'react'

import { signOut } from '../lib/auth/server.ts'
import { todayInToronto } from '../lib/crm/date-request.ts'
import { cad } from '../lib/crm/money.ts'
import {
  bookChartLabel,
  channelMeter,
  meterSegments,
  monthActivity,
  onTheBook,
  upcomingMonths,
} from '../lib/desk-console.ts'
import type {
  ConsoleBooking,
  ConsoleLead,
  ConsoleReview,
  Led,
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
} as const

const BANKS = [
  {
    k: 'A',
    n: 'The book',
    channels: [
      { name: 'Overview', to: '/desk', icon: 'home' },
      { name: 'Leads', to: '/desk/leads', icon: 'mail' },
      { name: 'Bookings', to: '/desk/bookings', icon: 'calendar' },
      { name: 'Portals', to: '/desk/portals', icon: 'lock' },
      { name: 'Invoices', to: '/desk/invoices', icon: 'file' },
      { name: 'Payments', to: '/desk/payments', icon: 'wallet' },
    ],
  },
  {
    k: 'B',
    n: 'The offer',
    channels: [
      { name: 'Packages', to: '/desk/packages', icon: 'box' },
      { name: 'Terms', to: '/desk/terms', icon: 'list' },
      { name: 'Questions', to: '/desk/questions', icon: 'help' },
    ],
  },
  {
    k: 'C',
    n: 'The site',
    channels: [
      { name: 'Reviews', to: '/desk/reviews', icon: 'star' },
      { name: 'Media', to: '/desk/media', icon: 'image' },
      { name: 'Partners', to: '/desk/partners', icon: 'users' },
    ],
  },
  {
    k: 'D',
    n: 'System',
    channels: [
      { name: 'Bots', to: '/desk/bots', icon: 'cpu' },
      { name: 'Settings', to: '/desk/settings', icon: 'sliders' },
    ],
  },
] as const

const LED: Record<Led, string> = {
  green: 'bg-emerald-400 shadow-[0_0_10px_#34d399]',
  amber: 'bg-amber-300 shadow-[0_0_10px_#fcd34d]',
  pink: 'bg-neon shadow-[0_0_10px_#FF007F]',
  off: 'bg-white/20',
}

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
  if (to === '/desk') return pathname === '/desk' || pathname === '/desk/'
  if (to === '/desk/portals')
    return pathname === '/desk/portals' || pathname.startsWith('/desk/portals/')
  return pathname === to
}

function bankIndex(pathname: string) {
  const index = BANKS.findIndex((bank) =>
    bank.channels.some((channel) => activePath(pathname, channel.to)),
  )
  return index < 0 ? 0 : index
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
  const routeBank = bankIndex(pathname)
  const [picked, setPicked] = useState<number | null>(null)
  const bank = picked ?? routeBank
  const today = todayInToronto()
  const months = upcomingMonths(today)
  const externalDates = data.externalDates.filter((row) => !row.released)
  const bookCount = onTheBook(data.bookings).length + externalDates.length
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

  useEffect(() => {
    setPicked(null)
  }, [pathname])

  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'auto' })
  }, [pathname])

  return (
    <div className="desk flex min-h-screen min-w-0 flex-col bg-ink-950 text-white">
      <header className="border-b border-white/10 bg-linear-to-b from-neon/10 to-transparent px-5 pt-4 pb-4 lg:px-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="font-display text-xl font-extrabold">
            PIPER <span className="text-neon text-glow">DESK</span>
          </p>
          <div className="flex flex-wrap items-center gap-3">
            <span className="flex items-center gap-1.5 text-xs text-white/65">
              <Lock className="h-3.5 w-3.5" aria-hidden="true" />
              Private. Piper only.
            </span>
            <button
              type="button"
              className="text-xs font-semibold text-white/65 hover:text-white"
              onClick={() => {
                void out({ data: {} }).then(async () => {
                  await router.navigate({ to: '/login' })
                })
              }}
            >
              Sign out
            </button>
          </div>
        </div>
        <div className="mt-3 flex items-end justify-between gap-3">
          <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-white/65">
            The book, next 24 months
          </p>
          <p className="text-xs text-white/65 tabular-nums">
            {bookCount} on the book · {cad(data.overview.totalCents)} counted
          </p>
        </div>
        <div
          className="mt-2 flex h-16 items-end gap-1"
          role="img"
          aria-label={bookChartLabel(
            data.bookings,
            data.leads,
            data.externalDates,
          )}
        >
          {months.map((month) => {
            const counts = monthActivity(
              month.key,
              data.bookings,
              data.leads,
              data.externalDates,
            )
            const empty = counts.booked + counts.held + counts.lead === 0
            const label = `${month.name} ${month.year}: ${counts.booked} booked, ${counts.held} held, ${counts.lead} lead`
            return (
              <button
                key={month.key}
                type="button"
                title={label}
                aria-label={label}
                onClick={() => {
                  void router.navigate({ to: '/desk/bookings' })
                }}
                className="flex h-full min-w-0 flex-1 flex-col justify-end"
              >
                <span className="flex h-full w-full flex-col justify-end overflow-hidden">
                  {counts.lead > 0 ? (
                    <span
                      className="w-full rounded-t border border-dashed border-white/50"
                      style={{ height: counts.lead * 18 }}
                    />
                  ) : null}
                  {counts.held > 0 ? (
                    <span
                      className="w-full bg-amber-300/80"
                      style={{ height: counts.held * 22 }}
                    />
                  ) : null}
                  {counts.booked > 0 ? (
                    <span
                      className="w-full bg-neon shadow-[0_0_12px_rgba(255,0,127,.7)]"
                      style={{ height: counts.booked * 22 }}
                    />
                  ) : null}
                  {empty ? (
                    <span className="h-1 w-full rounded-full bg-white/15" />
                  ) : null}
                </span>
              </button>
            )
          })}
        </div>
        <div className="mt-1 flex gap-1">
          {months.map((month, index) => (
            <span
              key={month.key}
              className="min-w-0 flex-1 text-center font-mono text-[9px] text-white/40"
            >
              {index % 3 === 0 ? month.short : ''}
            </span>
          ))}
        </div>
        <p className="mt-1.5 flex gap-4 text-[11px] text-white/65">
          <span>
            <span
              className="mr-1 inline-block h-2 w-2 bg-neon"
              aria-hidden="true"
            />
            Booked
          </span>
          <span>
            <span
              className="mr-1 inline-block h-2 w-2 bg-amber-300/80"
              aria-hidden="true"
            />
            Held
          </span>
          <span>
            <span
              className="mr-1 inline-block h-2 w-2 border border-dashed border-white/60"
              aria-hidden="true"
            />
            Lead
          </span>
        </p>
      </header>
      <main className="mx-auto w-full max-w-5xl min-w-0 flex-1 p-5 lg:p-8">
        {children}
      </main>
      <nav
        aria-label="Sections"
        className="sticky bottom-0 z-30 border-t border-white/15 bg-ink-900/95 px-3 pt-2.5 backdrop-blur-xl pb-[max(0.75rem,env(safe-area-inset-bottom))]"
      >
        <div className="mx-auto max-w-4xl">
          <div
            className="mb-2 flex flex-wrap items-center justify-center gap-2"
            role="tablist"
            aria-label="Channel bank"
          >
            {BANKS.map((item, index) => (
              <button
                key={item.k}
                type="button"
                role="tab"
                aria-selected={bank === index}
                onClick={() => setPicked(index)}
                className={`rounded-md border px-3 py-1 font-mono text-[10px] uppercase tracking-widest transition desk-motion ${
                  bank === index
                    ? 'border-neon bg-neon/20 text-white'
                    : 'border-white/10 text-white/65 hover:text-white'
                }`}
              >
                {item.k} · {item.n}
              </button>
            ))}
          </div>
          <div
            className="grid gap-2"
            style={{
              gridTemplateColumns: `repeat(${BANKS[bank]?.channels.length ?? 1}, minmax(0, 1fr))`,
            }}
          >
            {BANKS[bank]?.channels.map((channel) => {
              const meter = channelMeter(channel.name, meterInput, today)
              const on = activePath(pathname, channel.to)
              const Icon = ICONS[channel.icon]
              const segments = meterSegments(meter.fill)
              return (
                <Link
                  key={channel.name}
                  to={channel.to}
                  activeOptions={{ exact: true }}
                  aria-current={on ? 'page' : undefined}
                  aria-label={
                    meter.badge > 0
                      ? `${channel.name}, ${meter.badge}`
                      : undefined
                  }
                  className={`flex flex-col items-center gap-1.5 rounded-xl border px-1 py-2 transition desk-motion ${
                    on
                      ? 'border-neon bg-neon/10 shadow-[0_0_24px_rgba(255,0,127,.3)]'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <span
                    className={`h-1.5 w-1.5 rounded-full ${LED[meter.led]}`}
                  />
                  <span
                    className="flex h-12 w-3 flex-col-reverse gap-[2px] rounded-sm bg-black/50 p-[2px] sm:h-14"
                    aria-hidden="true"
                  >
                    {segments.map((lit, index) => (
                      <span
                        key={index}
                        className={`h-full w-full rounded-[1px] ${
                          lit
                            ? index > 5
                              ? 'bg-amber-300'
                              : 'bg-neon'
                            : 'bg-white/10'
                        }`}
                      />
                    ))}
                  </span>
                  <span className="relative">
                    <Icon
                      className={`h-4 w-4 ${on ? 'text-hot' : 'text-white/65'}`}
                      aria-hidden="true"
                    />
                    {meter.badge > 0 ? (
                      <span className="absolute -top-2 -right-3 grid h-4 min-w-4 place-items-center rounded-full bg-neon px-1 text-[10px] font-bold text-white">
                        {meter.badge}
                      </span>
                    ) : null}
                  </span>
                  <span
                    className={`text-center text-[10px] leading-tight font-semibold tracking-wide uppercase sm:text-xs ${
                      on ? 'text-white' : 'text-white/65'
                    }`}
                  >
                    {channel.name}
                  </span>
                </Link>
              )
            })}
          </div>
        </div>
      </nav>
    </div>
  )
}

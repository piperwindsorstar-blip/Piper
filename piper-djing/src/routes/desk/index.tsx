import { Link, createFileRoute, getRouteApi } from '@tanstack/react-router'
import { ArrowRight, Check, Lock, Mail, Plus, Wallet } from 'lucide-react'
import { useState } from 'react'
import type { ReactNode } from 'react'
import { Bar, CoupleName, deskCard, deskGhost, deskH2, deskKicker } from '../../components/desk-ui.tsx'
import { externalCouple, externalVenues } from '../../lib/crm/external-dates.ts'
import { cad } from '../../lib/crm/money.ts'
import { todayInToronto } from '../../lib/crm/date-request.ts'
import { moneySummary } from '../../lib/crm/money-summary.ts'
import { attention, daysUntil, onTheBook } from '../../lib/desk-console.ts'
import type { Attention } from '../../lib/desk-console.ts'
import { deskHead } from '../../lib/desk-head.ts'

const deskRoute = getRouteApi('/desk')

export const Route = createFileRoute('/desk/')({
  head: () => deskHead('Overview · DJ Piper P'),
  component: OverviewPage,
})

type DeskData = ReturnType<typeof deskRoute.useLoaderData>
type Booking = DeskData['bookings'][number]

const NUMBER_WORDS = ['No', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine']

function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Toronto',
      hour: 'numeric',
      hourCycle: 'h23',
    }).format(new Date()),
  )
  if (hour < 12) return 'Good morning'
  if (hour < 18) return 'Good afternoon'
  return 'Good evening'
}

function dayLine(iso: string): string {
  const day = new Date(`${iso}T12:00:00Z`)
  const weekday = day.toLocaleDateString('en-CA', { weekday: 'long', timeZone: 'UTC' })
  const date = day.toLocaleDateString('en-CA', { day: 'numeric', month: 'long', timeZone: 'UTC' })
  return `${weekday} · ${date}`
}

function shortDate(iso: string): string {
  return new Date(`${iso}T12:00:00Z`).toLocaleDateString('en-CA', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    timeZone: 'UTC',
  })
}

function inDays(days: number): string {
  if (days === 0) return 'today'
  if (days === 1) return 'tomorrow'
  return `in ${days} days`
}

function dollars(cents: number): string {
  return cad(cents).replace(/\.00$/, '')
}

function addDays(iso: string, days: number): string {
  const day = new Date(`${iso}T12:00:00Z`)
  day.setUTCDate(day.getUTCDate() + days)
  return day.toISOString().slice(0, 10)
}

function OverviewPage() {
  const desk = deskRoute.useLoaderData()
  const today = todayInToronto()
  const plans = desk.plans ?? []
  const todo = attention(desk.bookings, desk.leads, today, plans)
  const money = moneySummary(desk.bookings, desk.payments)
  const next = onTheBook(desk.bookings)
    .filter((booking) => booking.eventDate >= today)
    .sort((a, b) => a.eventDate.localeCompare(b.eventDate))
    .map((row) => desk.bookings.find((booking) => booking.id === row.id))
    .find(Boolean)
  const days = next ? daysUntil(today, next.eventDate) : 0
  const count = todo.length
  const subline = next
    ? `${next.partnerOne} & ${next.partnerTwo} ${days === 0 ? 'are getting married today' : `are ${days === 1 ? 'one day' : `${days} days`} out`}.${
        count === 0
          ? ' Nothing needs you right now.'
          : ` ${NUMBER_WORDS[count] ?? count} ${count === 1 ? 'thing needs' : 'things need'} you before then.`
      }`
    : count === 0
      ? 'A quiet day. Nothing needs you right now.'
      : `${NUMBER_WORDS[count] ?? count} ${count === 1 ? 'thing needs' : 'things need'} you.`

  return (
    <div className="grid gap-6">
      <header className="flex flex-wrap items-end justify-between gap-5">
        <div className="grid min-w-0 gap-1.5">
          <p className={deskKicker}>{dayLine(today)}</p>
          <h1 className="font-display text-[40px] leading-[1.02] font-extrabold tracking-[-0.02em] md:text-[52px]">
            {greeting()},{' '}
            <em className="font-serif font-normal tracking-normal text-[#ff007f] italic">Piper.</em>
          </h1>
          <p className="max-w-2xl text-base text-[#4a4262] md:text-lg">{subline}</p>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link to="/desk/money" className={deskGhost}>
            Record a payment
          </Link>
          <Link
            to="/desk/bookings"
            search={{ add: true }}
            className="inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#d1006b] px-5 text-sm font-semibold !text-white hover:bg-[#a30054]"
          >
            <Plus className="h-4.5 w-4.5" aria-hidden="true" />
            New booking
          </Link>
        </div>
      </header>

      <div className="grid gap-5 xl:grid-cols-[minmax(0,3fr)_minmax(17rem,1fr)]">
        {next ? <NextWedding booking={next} days={days} plans={plans} /> : <QuietHero />}
        <ThisWeek desk={desk} today={today} />
      </div>

      <div className="grid gap-5 lg:grid-cols-[minmax(0,3fr)_minmax(19rem,2fr)]">
        <NeedsYou items={todo} />
        <MoneyCard summary={money} />
      </div>

      <Season desk={desk} today={today} />
    </div>
  )
}

function NextWedding({
  booking,
  days,
  plans,
}: {
  booking: Booking
  days: number
  plans: { bookingId: number; percent: number; answered: number; total: number }[]
}) {
  const [copied, setCopied] = useState(false)
  const day = new Date(`${booking.eventDate}T12:00:00Z`)
  const dow = day.toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()
  const month = day.toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' }).toUpperCase()
  const total = booking.invoice?.totalCents ?? booking.totalCents
  const paid = Math.max(0, booking.invoice?.receivedCents ?? 0)
  const plan = plans.find((row) => row.bookingId === booking.id)
  const travel = booking.travel
  const travelValue =
    travel.km == null || travel.feeCents == null
      ? travel.source === 'failed'
        ? 'Not found'
        : 'Pending'
      : travel.feeCents === 0
        ? 'Included'
        : dollars(travel.feeCents)
  const travelNote =
    travel.km != null
      ? `${travel.km.toFixed(1)} km${travel.hotel ? ' · hotel' : ''}`
      : travel.error
        ? 'Google Maps did not answer'
        : 'Not worked out yet'

  return (
    <section
      aria-labelledby="next-up"
      className="grid min-w-0 overflow-hidden rounded-[20px] bg-[#1c1533] text-[#fff] shadow-[0_18px_40px_-24px_rgba(28,21,51,0.6)] sm:grid-cols-[9.5rem_minmax(0,1fr)]"
    >
      <div className="flex items-center justify-between gap-3 bg-[#ff007f] px-5 py-3 text-[#1c1533] sm:flex-col sm:justify-center sm:gap-0.5 sm:py-7 sm:text-center">
        <span className="text-[13px] font-bold tracking-[0.16em]">{dow}</span>
        <span className="font-display text-3xl leading-[0.9] font-extrabold tracking-[-0.04em] sm:text-[76px]">
          {day.getUTCDate()}
        </span>
        <span className="text-[13px] font-bold tracking-[0.16em]">
          {month} {day.getUTCFullYear()}
        </span>
      </div>
      <div className="grid min-w-0 gap-5 border-[#4b3f72] p-5 sm:border-l-2 sm:border-dashed sm:p-7">
        <div className="grid gap-1">
          <p className="text-xs font-bold tracking-[0.16em] text-[#ff8cc6] uppercase">
            Next up · {inDays(days)}
          </p>
          <h2 id="next-up" className="font-display text-[34px] leading-[1.02] font-extrabold tracking-[-0.02em] md:text-[40px]">
            <CoupleName one={booking.partnerOne} two={booking.partnerTwo} amp="text-[#ff8cc6]" />
          </h2>
          <p className="text-[#d9d0ea]">
            {[booking.venueName, booking.packageName].filter(Boolean).join(' · ')}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <Tile label="Paid">
            <span className="font-display text-[22px] leading-none font-extrabold">
              {dollars(paid)}{' '}
              <span className="font-sans text-sm font-medium text-[#cfc6e6]">of {dollars(total)}</span>
            </span>
            <Bar value={total > 0 ? (paid / total) * 100 : 0} label={`${cad(paid)} of ${cad(total)} paid`} color="bg-[#7ee2b0]" track="bg-[#3a2f5c]" height="h-1.5" />
          </Tile>
          <Tile label="Their plan">
            {plan ? (
              <>
                <span className="font-display text-[22px] leading-none font-extrabold">
                  {plan.percent}%{' '}
                  <span className="font-sans text-sm font-medium text-[#cfc6e6]">
                    {plan.answered} of {plan.total}
                  </span>
                </span>
                <Bar value={plan.percent} label={`${plan.percent}% planned`} color="bg-[#ff007f]" track="bg-[#3a2f5c]" height="h-1.5" />
              </>
            ) : (
              <span className="text-sm text-[#cfc6e6]">No plan yet</span>
            )}
          </Tile>
          <Tile label="Travel">
            <span className="font-display text-[22px] leading-none font-extrabold">{travelValue}</span>
            <span className="text-[13px] text-[#cfc6e6]">{travelNote}</span>
          </Tile>
        </div>
        <div className="flex flex-wrap gap-2.5">
          <Link
            to="/desk/bookings"
            search={{ couple: booking.id }}
            className="inline-flex min-h-11 items-center gap-2 rounded-lg bg-[#ff007f] px-5 font-bold text-[#1c1533] hover:bg-[#ff3d9a]"
          >
            Open their booking
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>
          <button
            type="button"
            className="inline-flex min-h-11 items-center rounded-lg border border-[#5a4c86] px-4 font-semibold text-[#fff] hover:bg-white/8"
            onClick={() => {
              void navigator.clipboard
                ?.writeText(`${window.location.origin}/c/${booking.slug}`)
                .then(() => {
                  setCopied(true)
                  window.setTimeout(() => setCopied(false), 2000)
                })
            }}
          >
            {copied ? 'Portal link copied' : 'Copy portal link'}
          </button>
        </div>
      </div>
    </section>
  )
}

function Tile({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="grid content-start gap-2 rounded-xl bg-[#261d45] p-3.5">
      <span className="text-xs font-bold tracking-[0.12em] text-[#b9aedb] uppercase">{label}</span>
      {children}
    </div>
  )
}

function QuietHero() {
  return (
    <section
      aria-labelledby="quiet-up"
      className="grid content-center gap-3.5 rounded-[20px] bg-[#1c1533] p-7 text-[#fff] shadow-[0_18px_40px_-24px_rgba(28,21,51,0.6)] sm:p-9"
    >
      <p className="text-xs font-bold tracking-[0.16em] text-[#ff8cc6] uppercase">
        Nothing on the book yet
      </p>
      <h2 id="quiet-up" className="font-display text-4xl leading-[1.05] font-extrabold tracking-[-0.02em]">
        Your next wedding shows up{' '}
        <em className="font-serif font-normal tracking-normal text-[#ff8cc6] italic">right here.</em>
      </h2>
      <p className="max-w-lg text-[#d9d0ea]">
        When a couple books, this card counts down to their day with what they have paid and how
        much of their plan is done.
      </p>
      <div className="flex flex-wrap gap-2.5">
        <Link
          to="/desk/bookings"
          search={{ add: true }}
          className="inline-flex min-h-11 items-center rounded-lg bg-[#ff007f] px-5 font-bold text-[#1c1533]"
        >
          New booking
        </Link>
      </div>
    </section>
  )
}

function ThisWeek({ desk, today }: { desk: DeskData; today: string }) {
  const end = addDays(today, 6)
  type Row = { key: string; date: string; couple: string; venue: string; pynx: boolean; company: string; id?: number }
  const rows: Row[] = [
    ...onTheBook(desk.bookings)
      .filter((booking) => booking.eventDate >= today && booking.eventDate <= end)
      .map((row) => {
        const booking = desk.bookings.find((item) => item.id === row.id)
        return {
          key: `b-${row.id}`,
          id: row.id,
          date: row.eventDate,
          couple: `${row.partnerOne} & ${row.partnerTwo}`,
          venue: booking?.venueName ?? '',
          pynx: false,
          company: '',
        }
      }),
    ...desk.externalDates
      .filter((row) => !row.released && row.eventDate >= today && row.eventDate <= end)
      .map((row) => ({
        key: `x-${row.id}`,
        date: row.eventDate,
        couple: (externalCouple(row) || row.company).replace(' and ', ' & '),
        venue: row.venueName || (externalVenues(row)[0] ?? '').split(',')[0] || '',
        pynx: true,
        company: row.company,
      })),
  ].sort((a, b) => a.date.localeCompare(b.date))
  const companies = [...new Set(rows.filter((row) => row.pynx).map((row) => row.company))]
  const allPynx = rows.length > 0 && rows.every((row) => row.pynx) && companies.length === 1
  const n = NUMBER_WORDS[rows.length] ?? String(rows.length)
  const title =
    rows.length === 0
      ? 'A free week'
      : allPynx
        ? `${n} ${companies[0]} ${rows.length === 1 ? 'gig' : 'gigs'}`
        : `${n} ${rows.length === 1 ? 'wedding' : 'weddings'}`

  return (
    <section aria-labelledby="this-week" className={`${deskCard} grid content-start gap-4`}>
      <div className="grid gap-0.5">
        <p className={deskKicker}>This week</p>
        <h2 id="this-week" className={deskH2}>
          {title}
        </h2>
      </div>
      {rows.length === 0 ? (
        <p className="text-[#5b5370]">No weddings in the next seven days, yours or Pynx's.</p>
      ) : (
        <ol className="grid">
          {rows.map((row, index) => {
            const days = daysUntil(today, row.date)
            const when = days === 0 ? 'Today' : days === 1 ? `Tomorrow · ${shortDate(row.date)}` : shortDate(row.date)
            return (
              <li key={row.key} className="flex gap-3.5">
                <span className="flex w-3.5 shrink-0 flex-col items-center">
                  <span
                    className={`mt-1.5 h-3 w-3 rounded-full ${row.pynx ? 'bg-[#8f7fc0] shadow-[0_0_0_4px_#efe9fb]' : 'bg-[#ff007f] shadow-[0_0_0_4px_#ffe3f0]'}`}
                  />
                  {index < rows.length - 1 ? <span className="mt-1.5 w-0.5 flex-1 bg-[#e6def4]" /> : null}
                </span>
                <span className="grid min-w-0 pb-4">
                  <span className="text-[13px] font-bold text-[#6b5fa0]">{when}</span>
                  {row.id ? (
                    <Link to="/desk/bookings" search={{ couple: row.id }} className="font-semibold text-[#1c1533] hover:text-[#d1006b]">
                      {row.couple}
                    </Link>
                  ) : (
                    <span className="font-semibold">{row.couple}</span>
                  )}
                  <span className="truncate text-sm text-[#5b5370]">
                    {[row.venue, row.pynx ? row.company : ''].filter(Boolean).join(' · ')}
                  </span>
                </span>
              </li>
            )
          })}
        </ol>
      )}
      <Link
        to="/desk/bookings"
        search={{ view: 'calendar' }}
        className="mt-auto inline-flex min-h-11 items-center gap-1.5 font-semibold text-[#d1006b] hover:underline"
      >
        See the calendar
        <ArrowRight className="h-4 w-4" aria-hidden="true" />
      </Link>
    </section>
  )
}

const KIND_ICON = {
  invoice: Mail,
  deposit: Wallet,
  lead: Mail,
  balance: Wallet,
  plan: Lock,
  email: Mail,
} as const

function NeedsYou({ items }: { items: Attention[] }) {
  return (
    <section aria-labelledby="needs-you" className={`${deskCard} grid content-start gap-3.5`}>
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="needs-you" className={deskH2}>
          Needs you
        </h2>
        <span className="text-sm text-[#5b5370]">
          {items.length === 0 ? 'Nothing' : `${items.length} ${items.length === 1 ? 'thing' : 'things'}`}
        </span>
      </div>
      {items.length === 0 ? (
        <p className="flex items-center gap-2.5 rounded-2xl bg-[#f1faf5] p-3.5 font-semibold text-[#0b5e41]">
          <Check className="h-5 w-5" aria-hidden="true" />
          All caught up. New inquiries and money due land here first.
        </p>
      ) : (
        <ul className="grid gap-2.5">
          {items.map((item) => {
            const Icon = KIND_ICON[item.kind]
            return (
              <li
                key={item.id}
                className="flex flex-wrap items-center gap-3.5 rounded-2xl border border-[#efe9f8] bg-[#faf8fe] p-3.5"
              >
                <span className="grid h-10 w-10 shrink-0 place-items-center rounded-[10px] bg-[#ffe3f0] text-[#d1006b]">
                  <Icon className="h-5 w-5" aria-hidden="true" />
                </span>
                <span className="grid min-w-0 flex-[1_1_14rem]">
                  <span className="font-semibold">{item.title}</span>
                  <span className="text-sm text-[#5b5370]">{item.detail}</span>
                </span>
                {item.to === '/desk/bookings' ? (
                  <Link
                    to="/desk/bookings"
                    search={item.couple ? { couple: item.couple } : {}}
                    className={`${deskGhost} shrink-0 !min-h-11 !px-4`}
                  >
                    {item.action}
                  </Link>
                ) : (
                  <Link to={item.to} className={`${deskGhost} shrink-0 !min-h-11 !px-4`}>
                    {item.action}
                  </Link>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

function MoneyCard({ summary }: { summary: ReturnType<typeof moneySummary> }) {
  const { totals, whoOwes } = summary
  const due = whoOwes[0]
  return (
    <section
      aria-labelledby="money-card"
      className="grid content-start gap-3.5 rounded-[20px] border border-[#eadff5] bg-[linear-gradient(135deg,#ffe6f2_0%,#eee8ff_55%,#e3f4fd_100%)] p-6"
    >
      <div className="flex items-baseline justify-between gap-3">
        <h2 id="money-card" className={deskH2}>
          Money on the book
        </h2>
        <Link to="/desk/money" className="inline-flex min-h-11 items-center text-sm font-semibold text-[#d1006b] hover:underline">
          Money
        </Link>
      </div>
      <div className="grid gap-0.5">
        <span className="text-sm text-[#4a4262]">Still to collect</span>
        <span className="font-display text-[56px] leading-none font-extrabold tracking-[-0.03em] tabular-nums">
          {dollars(totals.stillToCollectCents)}
        </span>
      </div>
      <Bar
        value={totals.bookedCents > 0 ? (totals.collectedCents / totals.bookedCents) * 100 : 0}
        label={`${cad(totals.collectedCents)} of ${cad(totals.bookedCents)} collected`}
        color="bg-[#1c1533]"
        track="bg-[#1c1533]/10"
        height="h-2.5"
      />
      <div className="flex justify-between gap-3 text-sm text-[#4a4262]">
        <span>
          <strong className="text-[#1c1533]">{dollars(totals.collectedCents)}</strong> collected
        </span>
        <span>
          <strong className="text-[#1c1533]">{dollars(totals.bookedCents)}</strong> booked
        </span>
      </div>
      {due ? (
        <div className="grid gap-0.5 rounded-xl bg-white/70 px-3.5 py-3">
          <span className="text-xs font-bold tracking-[0.12em] text-[#6b5fa0] uppercase">Next balance due</span>
          <span className="flex justify-between gap-3 font-semibold">
            <span>{due.names.replace(' and ', ' & ')}</span>
            <span>
              {dollars(due.leftCents)} by {shortDate(due.eventDate)}
            </span>
          </span>
        </div>
      ) : null}
      <p className="text-[13px] text-[#4a4262]">
        Your {totals.weddings} {totals.weddings === 1 ? 'wedding' : 'weddings'}. Pynx pays you for its
        dates separately.
      </p>
    </section>
  )
}

function Season({ desk, today }: { desk: DeskData; today: string }) {
  const year = Number(today.slice(0, 4))
  const month = Number(today.slice(5, 7)) - 1
  const months = Array.from({ length: 12 }, (_, index) => {
    const cursor = month + index
    const y = year + Math.floor(cursor / 12)
    const m = cursor % 12
    const key = `${y}-${String(m + 1).padStart(2, '0')}`
    const name = new Date(Date.UTC(y, m, 15)).toLocaleDateString('en-CA', { month: 'short', timeZone: 'UTC' })
    const yours = onTheBook(desk.bookings).filter((row) => row.eventDate.startsWith(key)).length
    const pynx = desk.externalDates.filter((row) => !row.released && row.eventDate.startsWith(key)).length
    return { key, name, yours, pynx }
  })
  const total = months.reduce((sum, row) => sum + row.yours + row.pynx, 0)
  return (
    <section aria-labelledby="season" className={`${deskCard} grid gap-4`}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="grid gap-0.5">
          <p className={deskKicker}>Your season</p>
          <h2 id="season" className={deskH2}>
            {total} {total === 1 ? 'wedding' : 'weddings'} in the next 12 months
          </h2>
        </div>
        <span className="flex gap-4 text-[13px] text-[#4a4262]">
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#ff007f]" aria-hidden="true" />
            Yours
          </span>
          <span className="inline-flex items-center gap-1.5">
            <span className="h-3 w-3 rounded bg-[#b3a6dc]" aria-hidden="true" />
            For Pynx
          </span>
        </span>
      </div>
      <div className="no-scrollbar overflow-x-auto">
        <div className="grid min-w-[40rem] grid-cols-12 items-end gap-2">
          {months.map((row) => {
            const n = row.yours + row.pynx
            return (
              <Link
                key={row.key}
                to="/desk/bookings"
                search={{ view: 'calendar', month: row.key }}
                aria-label={`${row.name}: ${n === 0 ? 'nothing booked' : `${n} ${n === 1 ? 'wedding' : 'weddings'}`}`}
                className="group grid gap-2 text-[#1c1533]"
              >
                <span className="flex h-28 flex-col-reverse gap-1 rounded-[10px] bg-[#f7f4fd] p-1.5 group-hover:bg-[#efe9fb]">
                  {Array.from({ length: row.yours }, (_, i) => (
                    <span key={`y${i}`} className="h-5 shrink-0 rounded-md bg-[#ff007f]" />
                  ))}
                  {Array.from({ length: row.pynx }, (_, i) => (
                    <span key={`p${i}`} className="h-5 shrink-0 rounded-md bg-[#b3a6dc]" />
                  ))}
                </span>
                <span className="text-center text-[13px] font-semibold">{row.name}</span>
              </Link>
            )
          })}
        </div>
      </div>
    </section>
  )
}

import { useState } from 'react'
import type { ReactNode } from 'react'
import { cad } from '../lib/crm/money.ts'

const TONE = {
  pink: 'border-[#ffc7e1] bg-[#ffe3f0] text-[#a3004f]',
  green: 'border-[#bfe8d3] bg-[#dcf3e7] text-[#0b5e41]',
  amber: 'border-[#f3d9a0] bg-[#fdf1d6] text-[#7a4b00]',
  gray: 'border-[#e2dbf5] bg-[#efe9fb] text-[#4b3f72]',
  red: 'border-rose-200 bg-rose-50 text-rose-700',
} as const

export type ChipTone = keyof typeof TONE

/** The desk is a light paper theme, so its feedback lines read dark. */
export const deskSurface = 'light' as const

export const deskPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#d1006b] px-5 py-2 text-sm font-semibold !text-white shadow-sm transition hover:bg-[#a30054] disabled:opacity-40 desk-motion'
/** The ink button: the one main action inside a white card. */
export const deskDark =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg bg-[#1c1533] px-5 py-2 text-sm font-semibold !text-white transition hover:bg-[#2f2550] disabled:opacity-40 desk-motion'
export const deskGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-[#d6cce8] bg-white px-5 py-2 text-sm font-semibold text-[#1c1533] transition hover:border-[#ff007f] hover:text-[#d1006b] disabled:opacity-40 desk-motion'
export const deskDanger =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-lg border border-rose-200 bg-white px-5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 desk-motion'
export const deskCard =
  'min-w-0 rounded-[20px] border border-[#e6def4] bg-white p-5 sm:p-6 shadow-[0_1px_2px_rgba(28,21,51,0.04)]'
/** The small pink label above a heading. */
export const deskKicker =
  'text-xs font-bold tracking-[0.16em] text-[#d1006b] uppercase'
/** A section heading inside a card. */
export const deskH2 = 'font-display text-2xl font-extrabold tracking-tight'

export function DeskTitle({
  kicker,
  title,
  children,
}: {
  kicker: string
  title: string
  children?: ReactNode
}) {
  return (
    <div className="min-w-0">
      {kicker && kicker !== title ? <p className={deskKicker}>{kicker}</p> : null}
      <h1 className="mt-1.5 font-display text-4xl leading-[1.02] font-extrabold tracking-[-0.02em] md:text-[52px]">
        {title}
      </h1>
      {children ? (
        <div className="mt-2 max-w-2xl text-base leading-relaxed text-[#4a4262] md:text-lg">
          {children}
        </div>
      ) : null}
    </div>
  )
}

export function Chip({
  children,
  tone = 'gray',
}: {
  children: ReactNode
  tone?: ChipTone
}) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-md border px-2 py-0.5 text-[11px] font-bold tracking-[0.08em] uppercase ${TONE[tone]}`}
    >
      {children}
      {/* A separator for innerText: flex items join with no space between. */}
      <span className="sr-only">{'\u00a0'}</span>
    </span>
  )
}

export function statusTone(status: string): ChipTone {
  if (status === 'hold') return 'amber'
  if (status === 'booked') return 'green'
  if (status === 'cancelled') return 'red'
  return 'gray'
}

export function invoiceTone(status: string): ChipTone {
  if (status === 'paid') return 'green'
  if (status === 'sent') return 'pink'
  if (status === 'void') return 'red'
  return 'gray'
}

export function ShowSwitch({
  checked,
  onChange,
}: {
  checked: boolean
  onChange: (checked: boolean) => void
}) {
  return (
    <label className="flex items-center gap-3 text-sm font-semibold">
      <span className="relative inline-flex h-6 w-11 shrink-0">
        <input
          name="show"
          type="checkbox"
          role="switch"
          aria-checked={checked}
          checked={checked}
          onChange={(event) => onChange(event.target.checked)}
          className="absolute inset-0 z-10 m-0 cursor-pointer opacity-0"
        />
        <span
          aria-hidden="true"
          className={`block h-6 w-11 rounded-full ${checked ? 'bg-neon' : 'bg-[#d9d1ea]'}`}
        />
        <span
          aria-hidden="true"
          className={`desk-motion absolute top-0.5 h-5 w-5 rounded-full bg-white ${checked ? 'left-[22px]' : 'left-0.5'}`}
        />
      </span>
      Show on site
    </label>
  )
}

/** Paid so far against the total, with the deposit marked. */
export function MoneyBar({
  totalCents,
  depositCents,
  receivedCents,
  discountCents,
}: {
  totalCents: number
  depositCents: number
  receivedCents: number
  discountCents: number
}) {
  const total = Math.max(0, totalCents)
  const paid = Math.min(Math.max(0, receivedCents), total)
  const left = Math.max(0, total - receivedCents)
  const pct = total > 0 ? (paid / total) * 100 : 0
  const depositPct = total > 0 ? Math.min(100, (depositCents / total) * 100) : 0
  return (
    <div className="mt-2 max-w-md">
      <div
        className="relative h-2 overflow-hidden rounded-full bg-[#eee8f7]"
        role="img"
        aria-label={`${cad(paid)} paid of ${cad(total)}`}
      >
        <span
          className={`absolute inset-y-0 left-0 rounded-full ${left === 0 && total > 0 ? 'bg-emerald-500' : 'bg-[#ff007f]'}`}
          style={{ width: `${pct}%` }}
        />
        {depositPct > 0 && depositPct < 100 ? (
          <span
            className="absolute inset-y-0 w-0.5 bg-[#1c1533]/40"
            style={{ left: `${depositPct}%` }}
            title="Deposit"
          />
        ) : null}
      </div>
      <p className="mt-1 text-xs text-white/65 tabular-nums">
        {total === 0
          ? 'No price set yet'
          : left === 0
            ? `Paid in full · ${cad(total)}`
            : `${cad(paid)} paid of ${cad(total)} · ${cad(left)} left`}
        {discountCents > 0 ? ` · ${cad(discountCents)} off` : ''}
        {total > 0 && receivedCents < depositCents
          ? ` · deposit ${cad(depositCents)}`
          : ''}
      </p>
    </div>
  )
}


/**
 * A delete that asks twice: the first tap turns it into "Tap again to
 * delete", the second does it. Tapping elsewhere cancels.
 */
export function ConfirmDelete({
  onConfirm,
  children = 'Delete',
  className = deskDanger,
}: {
  onConfirm: () => void
  children?: ReactNode
  className?: string
}) {
  const [asking, setAsking] = useState(false)
  return (
    <button
      type="button"
      className={className}
      onBlur={() => setAsking(false)}
      onClick={() => {
        if (!asking) {
          setAsking(true)
          return
        }
        setAsking(false)
        onConfirm()
      }}
    >
      {asking ? 'Tap again to confirm' : children}
    </button>
  )
}

/** "Roxana & Ibu" with the site's serif ampersand. */
export function CoupleName({
  one,
  two,
  amp = 'text-[#ff007f]',
}: {
  one: string
  two: string
  amp?: string
}) {
  return (
    <>
      {`${one ?? ''} `}
      <em className={`font-serif font-normal italic ${amp}`}>&amp;</em>{` ${two ?? ''}`}
    </>
  )
}

/** The pink-or-lilac date block: weekday, day, and month. */
export function DateBlock({
  date,
  mine = true,
  size = 'md',
}: {
  date: string
  mine?: boolean
  size?: 'sm' | 'md'
}) {
  const day = new Date(`${date}T12:00:00Z`)
  const dow = day.toLocaleDateString('en-CA', { weekday: 'short', timeZone: 'UTC' }).toUpperCase()
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-[10px] text-center leading-[1.05] ${
        size === 'sm' ? 'w-11 py-1.5' : 'w-12 py-1.5'
      } ${mine ? 'bg-[#ff007f] text-[#1c1533]' : 'bg-[#efe9fb] text-[#2f2550]'}`}
    >
      <span className="text-[10px] font-bold tracking-[0.12em]">{dow}</span>
      <span className="font-display text-[22px] font-extrabold">{day.getUTCDate()}</span>
    </span>
  )
}

/** A thin progress bar. */
export function Bar({
  value,
  label,
  color = 'bg-[#0f7b55]',
  track = 'bg-[#f0eaf9]',
  height = 'h-2',
}: {
  value: number
  label: string
  color?: string
  track?: string
  height?: string
}) {
  const pct = Math.max(0, Math.min(100, value))
  return (
    <span role="img" aria-label={label} className={`flex overflow-hidden rounded-full ${height} ${track}`}>
      <span className={color} style={{ width: `${pct}%` }} />
    </span>
  )
}

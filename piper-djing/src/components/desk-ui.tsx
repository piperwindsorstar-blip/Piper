import type { ReactNode } from 'react'

const TONE = {
  pink: 'border-pink-200 bg-pink-50 text-pink-700',
  green: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  amber: 'border-amber-200 bg-amber-50 text-amber-800',
  gray: 'border-[#e3dcf2] bg-[#f7f2fb] text-[#5b5370]',
  red: 'border-rose-200 bg-rose-50 text-rose-700',
} as const

export type ChipTone = keyof typeof TONE

/** The desk is a light paper theme, so its feedback lines read dark. */
export const deskSurface = 'light' as const

export const deskPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-neon px-5 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-hot disabled:opacity-40 desk-motion'
export const deskGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-[#e3dcf2] bg-white px-5 py-2 text-sm font-semibold text-[#1c1533] transition hover:border-[#ff007f] hover:text-[#d1006b] disabled:opacity-40 desk-motion'
export const deskDanger =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-rose-200 bg-white px-5 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-40 desk-motion'
export const deskCard =
  'min-w-0 rounded-2xl border border-[#e3dcf2] bg-white p-5 shadow-[0_1px_2px_rgba(28,21,51,0.05)]'

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
    <div>
      {kicker && kicker !== title ? (
        <p className="text-xs font-semibold tracking-wider text-[#d1006b] uppercase">
          {kicker}
        </p>
      ) : null}
      <h1 className="mt-1 font-display text-3xl font-bold tracking-tight md:text-4xl">
        {title}
      </h1>
      {children ? (
        <div className="mt-2 max-w-2xl text-sm leading-relaxed text-[#5b5370]">
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
      className={`inline-flex shrink-0 items-center rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${TONE[tone]}`}
    >
      {children}
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

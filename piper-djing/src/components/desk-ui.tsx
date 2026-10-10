import type { ReactNode } from 'react'

const TONE = {
  pink: 'border-neon/40 bg-neon/10 text-hot',
  green: 'border-emerald-400/30 bg-emerald-400/10 text-emerald-300',
  amber: 'border-amber-300/30 bg-amber-300/10 text-amber-200',
  gray: 'border-white/15 bg-white/5 text-white/65',
  red: 'border-rose-400/30 bg-rose-400/10 text-rose-300',
} as const

export type ChipTone = keyof typeof TONE

export const deskPrimary =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-neon px-4 py-2 text-sm font-bold text-white shadow-[0_0_20px_rgba(255,0,127,.4)] transition hover:bg-hot disabled:opacity-40 desk-motion'
export const deskGhost =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-white/20 px-4 py-2 text-sm font-bold text-white/85 transition hover:border-hot disabled:opacity-40 desk-motion'
export const deskDanger =
  'inline-flex min-h-11 items-center justify-center gap-2 rounded-full border border-rose-400/40 px-4 py-2 text-sm font-bold text-rose-300 transition hover:bg-rose-400/10 disabled:opacity-40 desk-motion'
export const deskCard =
  'min-w-0 rounded-2xl border border-white/10 bg-ink-900 p-5'

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
      <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-hot">
        {kicker}
      </p>
      <h1 className="mt-1 font-display text-3xl font-extrabold tracking-tight md:text-4xl">
        {title}
      </h1>
      {children}
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
          className={`block h-6 w-11 rounded-full ${checked ? 'bg-neon' : 'bg-white/20'}`}
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

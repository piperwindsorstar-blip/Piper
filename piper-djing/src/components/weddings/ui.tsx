import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { useDateDraft } from './date-draft.tsx'
import { Icon } from './icon.tsx'

export function Eyebrow({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <p
      className={`font-mono text-xs tracking-[0.22em] text-violet uppercase ${className}`}
    >
      {children}
    </p>
  )
}

const primaryClass =
  'group inline-flex items-center justify-center gap-2 rounded-lg bg-neon px-7 py-3.5 font-semibold text-white shadow-[0_8px_24px_-8px_rgba(255,0,127,0.6)] transition hover:bg-hot'

const outlineClass =
  'inline-flex items-center justify-center gap-2 rounded-lg border border-ink px-7 py-3.5 font-semibold text-ink transition hover:bg-ink hover:text-white'

export function ButtonPrimary({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  const { date } = useDateDraft()
  return (
    <Link
      to="/book"
      search={date ? { date } : {}}
      className={`${primaryClass} ${className}`}
    >
      {children}
      <Icon
        n="arrow"
        className="h-4 w-4 transition group-hover:translate-x-1"
      />
    </Link>
  )
}

export function ButtonOutline({
  children,
  to = '#packages',
  className = '',
}: {
  children: ReactNode
  to?: string
  className?: string
}) {
  return (
    <a href={to} className={`${outlineClass} ${className}`}>
      {children}
    </a>
  )
}

import { Link } from '@tanstack/react-router'
import type { ReactNode } from 'react'
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
      className={`font-mono text-xs uppercase tracking-[0.22em] text-hot ${className}`}
    >
      {children}
    </p>
  )
}

export function Stars({ className = 'h-4 w-4' }: { className?: string }) {
  return (
    <span
      className="inline-flex gap-0.5 text-amber-300"
      role="img"
      aria-label="5 out of 5 stars"
    >
      {[0, 1, 2, 3, 4].map((i) => (
        <Icon key={i} n="star" fill="currentColor" className={className} />
      ))}
    </span>
  )
}

export function ButtonPrimary({
  children,
  to,
  className = '',
}: {
  children: ReactNode
  to: '/weddings' | '/book'
  className?: string
}) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center justify-center gap-2 rounded-full bg-neon px-7 py-3.5 font-semibold text-white shadow-[0_0_28px_rgba(255,0,127,0.45)] transition hover:bg-hot hover:shadow-[0_0_44px_rgba(255,20,147,0.7)] ${className}`}
    >
      {children}
      <Icon
        n="arrow"
        className="h-4 w-4 transition group-hover:translate-x-1"
      />
    </Link>
  )
}

export function ButtonGhost({
  children,
  to,
  className = '',
}: {
  children: ReactNode
  to: '/weddings' | '/book'
  className?: string
}) {
  return (
    <Link
      to={to}
      className={`inline-flex items-center justify-center gap-2 rounded-full border border-white/25 px-7 py-3.5 font-semibold text-white transition hover:border-hot hover:shadow-[0_0_24px_rgba(255,20,147,0.35)] ${className}`}
    >
      {children}
    </Link>
  )
}

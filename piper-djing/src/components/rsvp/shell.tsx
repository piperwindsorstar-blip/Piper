import type { ReactNode } from 'react'

export const rsvpButton =
  'inline-flex min-h-11 w-full items-center justify-center rounded-full bg-[var(--pink)] px-5 text-base font-semibold text-[#0D0D0D] disabled:opacity-60'
export const rsvpGhost =
  'inline-flex min-h-11 w-full items-center justify-center rounded-full border border-[var(--border-strong)] bg-transparent px-5 text-base font-semibold text-white'
export const rsvpField =
  'min-h-12 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--field)] px-4 text-base text-white outline-none'

export function RsvpFrame({ children }: { children: ReactNode }) {
  return (
    <main
      className="portal min-h-screen px-4 py-6"
      style={{
        backgroundImage:
          'radial-gradient(ellipse at top, #2A1220 0%, #0D0D0D 45%)',
      }}
    >
      <div className="mx-auto w-full max-w-[430px]">{children}</div>
    </main>
  )
}

export function RsvpHeader({ step }: { step?: string }) {
  return (
    <header className="mb-8 flex items-center justify-between gap-3">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-[var(--pink)] text-sm font-bold text-[#0D0D0D]">
          P
        </span>
        Piper P · RSVP
      </div>
      {step ? (
        <span className="text-sm text-[var(--text-muted)]">{step}</span>
      ) : null}
    </header>
  )
}

export function Steps({ step }: { step: 1 | 2 | 3 }) {
  return (
    <div className="mb-6 grid grid-cols-3 gap-2" aria-hidden="true">
      {[1, 2, 3].map((item) => (
        <span
          key={item}
          className={`h-1 rounded-full ${item <= step ? 'bg-[var(--pink)]' : 'bg-[var(--border-strong)]'}`}
        />
      ))}
    </div>
  )
}

export function Field({
  id,
  label,
  error,
  children,
}: {
  id: string
  label: string
  error?: string
  children: ReactNode
}) {
  return (
    <div className="grid gap-2">
      <label className="text-sm text-[var(--text-muted)]" htmlFor={id}>
        {label}
      </label>
      {children}
      {error ? (
        <p id={`${id}-error`} className="text-sm text-[var(--pink-soft)]">
          {error}
        </p>
      ) : null}
    </div>
  )
}

export function downloadText(filename: string, body: string, type: string) {
  const blob = new Blob([body], { type })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

import { createContext, useContext } from 'react'
import type { ReactNode } from 'react'
import { templateFor } from '../../lib/rsvp/templates.ts'
import type { PhotoShape, RsvpTemplateId } from '../../lib/rsvp/templates.ts'

/** The couple's photo, as the guest pages show it. */
export type GuestPhoto = {
  url: string
  shape: PhotoShape
  alt: string
  /** The photo's own proportions, so a full photo keeps its shape. */
  width: number
  height: number
}

export type RsvpStyle = {
  theme: 'dark' | 'light'
  template: RsvpTemplateId
  photo: GuestPhoto | null
}

const RsvpStyleContext = createContext<RsvpStyle>({
  theme: 'dark',
  template: 'ivory',
  photo: null,
})

export function RsvpThemeProvider({
  theme,
  template = 'ivory',
  photo = null,
  children,
}: {
  theme: 'dark' | 'light'
  template?: RsvpTemplateId
  photo?: GuestPhoto | null
  children: ReactNode
}) {
  return (
    <RsvpStyleContext.Provider value={{ theme, template, photo }}>
      {children}
    </RsvpStyleContext.Provider>
  )
}

export function useRsvpTheme(): 'dark' | 'light' {
  return useContext(RsvpStyleContext).theme
}

export function useRsvpStyle(): RsvpStyle {
  return useContext(RsvpStyleContext)
}

export const rsvpButton =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full bg-[var(--pink)] px-5 text-base font-semibold text-[#0D0D0D] transition hover:brightness-110 active:brightness-90 disabled:opacity-60'
export const rsvpGhost =
  'inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-full border border-[var(--border-strong)] bg-transparent px-5 text-base font-semibold text-[var(--text)] transition hover:border-[var(--pink)] active:brightness-90'
export const rsvpField =
  'min-h-12 w-full rounded-2xl border border-[var(--border-strong)] bg-[var(--field)] px-4 text-base text-[var(--text)] outline-none'

/**
 * The guest page wears the couple's template: the same paper tint, the same
 * accent, the same display face as the letter, plus their photo at the top.
 */
export function RsvpFrame({ children }: { children: ReactNode }) {
  const { theme, template, photo } = useRsvpStyle()
  const { skin } = templateFor(template)
  const web = skin.web
  const light = web ? web.light : theme === 'light'
  const backdrop = web
    ? web.backdrop
    : theme === 'light'
      ? undefined
      : 'radial-gradient(ellipse at top, #2A1220 0%, #0D0D0D 45%)'
  return (
    <main
      className={`portal min-h-screen px-4 py-6 ${light ? 'light' : ''}`}
      style={
        {
          ...(web?.vars ?? {}),
          '--display-font': skin.displayFont,
          backgroundImage: backdrop,
        } as React.CSSProperties
      }
    >
      <div className="mx-auto w-full max-w-[430px]">
        {photo ? <RsvpPhoto photo={photo} /> : null}
        {children}
      </div>
    </main>
  )
}

/**
 * The couple's photo. "Full photo" shows the whole picture at its own shape,
 * full width, with nothing cut off. Banner, circle and arch show the shaped
 * rendition the couple positioned.
 */
export function RsvpPhoto({ photo }: { photo: GuestPhoto }) {
  if (photo.shape === 'full') {
    return (
      <img
        src={photo.url}
        alt={photo.alt}
        className="mx-auto mb-6 block h-auto w-full"
        style={{
          maxWidth: '100%',
          borderRadius: '14px',
          ...(photo.width > 0 && photo.height > 0
            ? { aspectRatio: `${photo.width} / ${photo.height}` }
            : {}),
        }}
      />
    )
  }
  const radius = photo.shape === 'circle' ? '50%' : '999px 999px 0 0'
  const width = photo.shape === 'circle' ? '64%' : '76%'
  return (
    <img
      src={photo.url}
      alt={photo.alt}
      className="mx-auto mb-6 block h-auto object-cover"
      style={{ width, borderRadius: radius }}
    />
  )
}

/**
 * The brand mark in the RSVP header. Dark pages read the white-and-pink mark,
 * light pages the ink mark.
 */
export function RsvpLogo({ className = 'h-9 w-auto' }: { className?: string }) {
  const { theme, template } = useRsvpStyle()
  const web = templateFor(template).skin.web
  const light = web ? web.light : theme === 'light'
  return (
    <img
      src={light ? '/photos/logo-inverted.png' : '/brand/dj-piper-p.png'}
      alt="DJ Piper P"
      className={className}
    />
  )
}

export function RsvpHeader({ step }: { step?: string }) {
  return (
    <header className="mb-8 flex items-center justify-between gap-3">
      <RsvpLogo />
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

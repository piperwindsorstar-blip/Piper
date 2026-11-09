import { getCookie, getRequest, setCookie } from '@tanstack/react-start/server'

const MANAGE = 'piper_rsvp'
const GATE = 'piper_rsvp_gate'

function secureCookie() {
  const secure = new URL(getRequest().url).protocol === 'https:'
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
  }
}

export function rsvpSlugFromCookie(): string {
  return getCookie(MANAGE)?.trim().toLowerCase() ?? ''
}

export function rememberRsvpSlug(slug: string): void {
  setCookie(MANAGE, slug, {
    ...secureCookie(),
    maxAge: 60 * 60 * 24 * 14,
  })
}

export function gateOpen(slug: string): boolean {
  const value = getCookie(GATE) ?? ''
  return value.split(' ').includes(slug)
}

export function rememberGate(slug: string): void {
  const current = (getCookie(GATE) ?? '').split(' ').filter((item) => item)
  const next = [slug, ...current.filter((item) => item !== slug)].slice(0, 8)
  setCookie(GATE, next.join(' '), {
    ...secureCookie(),
    maxAge: 60 * 60 * 24 * 30,
  })
}

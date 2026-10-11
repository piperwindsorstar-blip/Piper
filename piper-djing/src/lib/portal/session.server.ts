import { getCookie, getRequest, setCookie } from '@tanstack/react-start/server'

const COOKIE = 'piper_couple'

export function coupleSlugFromCookie(): string {
  return getCookie(COOKIE)?.trim() ?? ''
}

export function rememberCoupleSlug(slug: string): void {
  const secure = new URL(getRequest().url).protocol === 'https:'
  setCookie(COOKIE, slug, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })
}

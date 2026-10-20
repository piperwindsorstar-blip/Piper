import { createHash, timingSafeEqual } from 'node:crypto'
import { getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { query } from '../db.server.ts'

const COOKIE = 'piper_couple'

/**
 * The couple cookie holds the plan's slug and a seal made from its passcode,
 * so it only opens after the passcode was typed, and a changed passcode ends
 * every open session.
 */
function seal(slug: string, passcode: string): string {
  return createHash('sha256')
    .update(`piper-couple:${slug}:${passcode.trim().toUpperCase()}`)
    .digest('hex')
    .slice(0, 32)
}

async function passcodeFor(slug: string): Promise<string> {
  const rows = await query<{ portal_passcode?: string }>(
    'SELECT portal_passcode FROM bookings WHERE slug = $1',
    [slug],
  )
  return (rows.at(0)?.portal_passcode ?? '').trim().toUpperCase()
}

export async function coupleSlugFromCookie(): Promise<string> {
  const raw = getCookie(COOKIE)?.trim() ?? ''
  const cut = raw.lastIndexOf('.')
  if (cut <= 0) return ''
  const slug = raw.slice(0, cut)
  const mark = raw.slice(cut + 1)
  try {
    const passcode = await passcodeFor(slug)
    if (!passcode) return ''
    const want = Buffer.from(seal(slug, passcode))
    const got = Buffer.from(mark)
    return want.length === got.length && timingSafeEqual(want, got) ? slug : ''
  } catch {
    return ''
  }
}

export async function rememberCoupleSlug(slug: string): Promise<void> {
  const passcode = await passcodeFor(slug)
  if (!passcode) throw new Error('This plan has no passcode yet.')
  const secure = new URL(getRequest().url).protocol === 'https:'
  setCookie(COOKIE, `${slug}.${seal(slug, passcode)}`, {
    httpOnly: true,
    sameSite: 'lax',
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 180,
  })
}

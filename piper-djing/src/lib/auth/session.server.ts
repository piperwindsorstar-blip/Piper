import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { query } from '../db.server.ts'

const COOKIE = 'piper_desk'

function expectedPassword(): string | null {
  if (process.env.DESK_PASSWORD) return process.env.DESK_PASSWORD
  if (!process.env.DATABASE_URL) return 'piper-local'
  return null
}

function digest(value: string): Buffer {
  return createHash('sha256').update(value).digest()
}

export function passwordsMatch(given: string, expected: string): boolean {
  const left = digest(given)
  const right = digest(expected)
  return timingSafeEqual(left, right)
}

export async function isDesk(): Promise<boolean> {
  const id = getCookie(COOKIE)
  if (!id) return false
  const rows = await query<{ id: string }>('SELECT id FROM sessions WHERE id = $1', [id])
  return rows.length > 0
}

export async function requireDesk(): Promise<void> {
  if (!(await isDesk())) throw new Error('Sign in required.')
}

function cookieOptions() {
  const secure = new URL(getRequest().url).protocol === 'https:'
  return {
    httpOnly: true,
    sameSite: 'lax' as const,
    secure,
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  }
}

export async function startDeskSession(password: string): Promise<boolean> {
  const expected = expectedPassword()
  if (!expected || !passwordsMatch(password, expected)) return false
  const id = randomBytes(24).toString('hex')
  await query('INSERT INTO sessions (id) VALUES ($1)', [id])
  setCookie(COOKIE, id, cookieOptions())
  return true
}

export async function endDeskSession(): Promise<void> {
  const id = getCookie(COOKIE)
  if (id) await query('DELETE FROM sessions WHERE id = $1', [id])
  deleteCookie(COOKIE, { path: '/' })
}

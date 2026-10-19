import { createHash, randomBytes, timingSafeEqual } from 'node:crypto'
import {
  deleteCookie,
  getCookie,
  getRequest,
  setCookie,
} from '@tanstack/react-start/server'
import { query, usesEdgeBook } from '../db.server.ts'

// Renamed Oct 2026 so every session opened before the password fix ends.
const COOKIE = 'piper_desk_v2'

/**
 * The desk password is the DESK_PASSWORD secret. Only a local development
 * book (no database, not the live Worker) falls back to "piper-local"; the
 * live site stays locked until the secret is set.
 */
function expectedPassword(): string | null {
  const secret = process.env.DESK_PASSWORD?.trim()
  if (secret) return secret
  if (!process.env.DATABASE_URL && !usesEdgeBook()) return 'piper-local'
  return null
}

export function deskPasswordSet(): boolean {
  return expectedPassword() !== null
}

const WINDOW_MS = 15 * 60_000
const MAX_TRIES = 8

function clientKey(): string {
  try {
    const request = getRequest()
    return (
      (request.headers.get('cf-connecting-ip') ||
        request.headers.get('x-forwarded-for') ||
        'local').split(',')[0]?.trim() || 'local'
    )
  } catch {
    return 'local'
  }
}

/**
 * Wrong passwords live in the book, not in memory: a Worker restarts often,
 * and a count kept in memory started over every time. Addresses are stored
 * hashed. If the book cannot be reached, the memory count still applies.
 */
const MISSES = `CREATE TABLE IF NOT EXISTS login_misses (
  who text NOT NULL,
  at bigint NOT NULL
)`
let missesReady: Promise<void> | null = null
const memory = new Map<string, number[]>()

function missesTable(): Promise<void> {
  if (!missesReady) {
    missesReady = query(MISSES)
      .then(() => undefined)
      .catch((error: unknown) => {
        missesReady = null
        throw error
      })
  }
  return missesReady
}

function who(key: string): string {
  return createHash('sha256').update(`desk-login:${key}`).digest('hex')
}

/** Eight wrong passwords in 15 minutes locks that address out for a while. */
async function lockedOut(key: string, now: number): Promise<boolean> {
  const recent = (memory.get(key) ?? []).filter((at) => now - at < WINDOW_MS)
  memory.set(key, recent)
  try {
    await missesTable()
    const rows = await query<{ count: unknown }>(
      'SELECT COUNT(*) AS count FROM login_misses WHERE who = $1 AND at > $2',
      [who(key), now - WINDOW_MS],
    )
    return Math.max(Number(rows.at(0)?.count ?? 0), recent.length) >= MAX_TRIES
  } catch {
    return recent.length >= MAX_TRIES
  }
}

async function noteMiss(key: string, now: number): Promise<void> {
  memory.set(key, [
    ...(memory.get(key) ?? []).filter((at) => now - at < WINDOW_MS),
    now,
  ])
  try {
    await missesTable()
    await query('DELETE FROM login_misses WHERE at <= $1', [now - WINDOW_MS])
    await query('INSERT INTO login_misses (who, at) VALUES ($1, $2)', [
      who(key),
      now,
    ])
  } catch {
    // The memory count above still holds for this instance.
  }
}

async function clearMisses(key: string): Promise<void> {
  memory.delete(key)
  try {
    await missesTable()
    await query('DELETE FROM login_misses WHERE who = $1', [who(key)])
  } catch {
    // Nothing to clear if the book cannot be reached.
  }
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
  // No password set on the live site: nobody is signed in.
  if (!deskPasswordSet()) return false
  const id = getCookie(COOKIE)
  if (!id) return false
  const rows = await query<{ id: string }>(
    'SELECT id FROM sessions WHERE id = $1',
    [id],
  )
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

export async function startDeskSession(
  password: string,
): Promise<'ok' | 'wrong' | 'locked' | 'unset'> {
  const expected = expectedPassword()
  if (!expected) return 'unset'
  const key = clientKey()
  const now = Date.now()
  if (await lockedOut(key, now)) return 'locked'
  if (!passwordsMatch(password, expected)) {
    await noteMiss(key, now)
    return 'wrong'
  }
  await clearMisses(key)
  const id = randomBytes(24).toString('hex')
  await query('INSERT INTO sessions (id) VALUES ($1)', [id])
  setCookie(COOKIE, id, cookieOptions())
  return 'ok'
}

export async function endDeskSession(): Promise<void> {
  const id = getCookie(COOKIE)
  if (id) await query('DELETE FROM sessions WHERE id = $1', [id])
  deleteCookie(COOKIE, { path: '/' })
}

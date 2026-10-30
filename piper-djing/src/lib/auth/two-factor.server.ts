import { deleteCookie, getCookie, getRequest, setCookie } from '@tanstack/react-start/server'
import { query, queryBatch, usesEdgeBook } from '../db.server.ts'
import { renderSVG } from '../vendor/uqr/index.mjs'
import {
  clearMisses,
  clientKey,
  cookieOptions,
  lockedOut,
  noteMiss,
  openDeskSession,
  slowDown,
} from './session.server.ts'
import {
  decryptSecret,
  encryptSecret,
  groupSecret,
  keyedHash,
  looksLikeBackupCode,
  matchTotp,
  newBackupCodes,
  newTotpSecret,
  normalizeBackupCode,
  otpauthUrl,
  randomToken,
} from './totp.ts'

/**
 * Two-step sign-in for the Desk: the password, then a 6-digit code from an
 * authenticator app (or a single-use backup code).
 *
 * - The TOTP secret is stored encrypted (AES-GCM) with DESK_2FA_KEY, a Worker
 *   secret that is never in the database. It is shown once, while setting up,
 *   and never again.
 * - Backup codes and device tokens are stored only as keyed hashes.
 * - Codes are never logged. Wrong codes count toward the same five-try limit
 *   as wrong passwords, and both get the same message.
 * - There is no reset link and no email bypass. Recovery without the phone and
 *   without a backup code is done by the site owner in the database.
 */

const STEP_COOKIE = 'piper_desk_step'
const TRUST_COOKIE = 'piper_desk_trusted'
const STEP_MS = 10 * 60_000
const TRUST_DAYS = 30

const TABLES = [
  `CREATE TABLE IF NOT EXISTS desk_2fa (
    id integer PRIMARY KEY,
    secret_enc text NOT NULL,
    key_check text NOT NULL,
    active integer NOT NULL DEFAULT 0,
    last_step bigint NOT NULL DEFAULT 0,
    enrolled_at bigint NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS desk_backup_codes (
    hash text PRIMARY KEY,
    used_at bigint NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS desk_trusted (
    hash text PRIMARY KEY,
    label text NOT NULL DEFAULT '',
    created_at bigint NOT NULL,
    expires_at bigint NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS desk_login_steps (
    hash text PRIMARY KEY,
    created_at bigint NOT NULL
  )`,
]

let ready: Promise<void> | null = null

function ensureTables(): Promise<void> {
  if (!ready) {
    ready = queryBatch(TABLES.map((sql) => ({ sql }))).then(
      () => undefined,
      (error: unknown) => {
        ready = null
        throw error
      },
    )
  }
  return ready
}

/**
 * The encryption key. On the live site it must be the DESK_2FA_KEY secret
 * (the deploy sets it once). A local development book uses a fixed key.
 */
function keyMaterial(): string | null {
  const secret = process.env.DESK_2FA_KEY?.trim()
  if (secret) return secret
  if (!process.env.DATABASE_URL && !usesEdgeBook()) return 'piper-local-2fa-key'
  return null
}

type Row = {
  secret_enc: string
  key_check: string
  active: unknown
  last_step: unknown
  enrolled_at: unknown
}

async function stateRow(): Promise<Row | null> {
  await ensureTables()
  const rows = await query<Row>(
    'SELECT secret_enc, key_check, active, last_step, enrolled_at FROM desk_2fa WHERE id = 1',
  )
  return rows.at(0) ?? null
}

const active = (row: Row | null) => Boolean(row && Number(row.active) === 1)

async function secretOf(row: Row, material: string): Promise<string> {
  if ((await keyedHash('key-check', material)) !== row.key_check) {
    throw new Error(
      'Two-step sign-in cannot read its key (DESK_2FA_KEY changed). See the recovery notes in Desk → Security.',
    )
  }
  return decryptSecret(row.secret_enc, material)
}

// --- Cookies and the half-signed-in step ----------------------------------------

function shortCookie(maxAgeSeconds: number) {
  return { ...cookieOptions(), maxAge: maxAgeSeconds }
}

async function openStep(material: string): Promise<void> {
  const token = randomToken()
  const now = Date.now()
  await query('DELETE FROM desk_login_steps WHERE created_at <= $1', [now - STEP_MS])
  await query('INSERT INTO desk_login_steps (hash, created_at) VALUES ($1, $2)', [
    await keyedHash(`step:${token}`, material),
    now,
  ])
  setCookie(STEP_COOKIE, token, shortCookie(STEP_MS / 1000))
}

/** True when this browser passed the password step in the last 10 minutes. */
async function stepValid(material: string): Promise<boolean> {
  const token = getCookie(STEP_COOKIE)
  if (!token) return false
  const rows = await query<{ created_at: unknown }>(
    'SELECT created_at FROM desk_login_steps WHERE hash = $1',
    [await keyedHash(`step:${token}`, material)],
  )
  const at = Number(rows.at(0)?.created_at ?? 0)
  return at > 0 && Date.now() - at < STEP_MS
}

async function closeStep(material: string): Promise<void> {
  const token = getCookie(STEP_COOKIE)
  if (token) {
    await query('DELETE FROM desk_login_steps WHERE hash = $1', [await keyedHash(`step:${token}`, material)])
  }
  deleteCookie(STEP_COOKIE, { path: '/' })
}

function deviceLabel(): string {
  let agent = ''
  try {
    agent = getRequest().headers.get('user-agent') ?? ''
  } catch {
    agent = ''
  }
  const browser = /Edg\//.test(agent)
    ? 'Edge'
    : /SamsungBrowser/.test(agent)
      ? 'Samsung Internet'
      : /Chrome\//.test(agent)
        ? 'Chrome'
        : /Firefox\//.test(agent)
          ? 'Firefox'
          : /Safari\//.test(agent)
            ? 'Safari'
            : 'A browser'
  const system = /Android/.test(agent)
    ? 'Android'
    : /iPhone|iPad/.test(agent)
      ? 'iPhone or iPad'
      : /Windows/.test(agent)
        ? 'Windows'
        : /Mac OS X/.test(agent)
          ? 'Mac'
          : /Linux/.test(agent)
            ? 'Linux'
            : ''
  return system ? `${browser} on ${system}` : browser
}

async function trustThisDevice(material: string): Promise<void> {
  const token = randomToken()
  const now = Date.now()
  await query(
    'INSERT INTO desk_trusted (hash, label, created_at, expires_at) VALUES ($1, $2, $3, $4)',
    [await keyedHash(`trust:${token}`, material), deviceLabel(), now, now + TRUST_DAYS * 86_400_000],
  )
  setCookie(TRUST_COOKIE, token, shortCookie(TRUST_DAYS * 86_400))
}

async function trustedHash(material: string): Promise<string | null> {
  const token = getCookie(TRUST_COOKIE)
  return token ? keyedHash(`trust:${token}`, material) : null
}

async function deviceTrusted(material: string): Promise<boolean> {
  const hash = await trustedHash(material)
  if (!hash) return false
  const rows = await query<{ expires_at: unknown }>('SELECT expires_at FROM desk_trusted WHERE hash = $1', [hash])
  return Number(rows.at(0)?.expires_at ?? 0) > Date.now()
}

// --- Sign-in steps ------------------------------------------------------------------

/** After a right password: straight in on a trusted device, else the code step. */
export async function afterPassword(): Promise<'ok' | 'code' | 'enroll' | 'unavailable'> {
  const material = keyMaterial()
  if (!material) return 'unavailable'
  const row = await stateRow()
  if (active(row) && (await deviceTrusted(material))) {
    await clearMisses(clientKey())
    await openDeskSession()
    return 'ok'
  }
  await openStep(material)
  return active(row) ? 'code' : 'enroll'
}

export type StepResult =
  | { ok: true; backupCodes?: string[] }
  | { ok: false; reason: 'wrong' | 'locked' | 'expired' | 'unavailable'; message?: string }

async function guard(): Promise<{ material: string } | StepResult> {
  const material = keyMaterial()
  if (!material) return { ok: false, reason: 'unavailable' }
  if (await lockedOut(clientKey(), Date.now())) return { ok: false, reason: 'locked' }
  if (!(await stepValid(material))) return { ok: false, reason: 'expired' }
  return { material }
}

async function miss(): Promise<StepResult> {
  await noteMiss(clientKey(), Date.now())
  await slowDown()
  return { ok: false, reason: 'wrong' }
}

async function finish(material: string, trust: boolean): Promise<void> {
  await clearMisses(clientKey())
  await closeStep(material)
  await openDeskSession()
  if (trust) await trustThisDevice(material)
}

/** The QR code and typed secret for setting up, only before 2FA is on. */
export async function startEnrollment(): Promise<
  { ok: true; qrSvg: string; secret: string } | { ok: false; reason: string }
> {
  const checked = await guard()
  if ('ok' in checked) return { ok: false, reason: checked.reason }
  const { material } = checked
  if (active(await stateRow())) return { ok: false, reason: 'enrolled' }
  const secret = newTotpSecret()
  await query(
    `INSERT INTO desk_2fa (id, secret_enc, key_check, active, last_step, enrolled_at)
     VALUES (1, $1, $2, 0, 0, 0)
     ON CONFLICT (id) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, key_check = EXCLUDED.key_check,
       active = 0, last_step = 0, enrolled_at = 0`,
    [await encryptSecret(secret, material), await keyedHash('key-check', material)],
  )
  // Guard against a race: never overwrite a secret that went active.
  return {
    ok: true,
    qrSvg: renderSVG(otpauthUrl(secret), { border: 2, ecc: 'M', pixelSize: 6, whiteColor: '#ffffff', blackColor: '#000000' }),
    secret: groupSecret(secret),
  }
}

async function replaceBackupCodes(material: string): Promise<string[]> {
  const codes = newBackupCodes()
  const hashes = await Promise.all(codes.map((code) => keyedHash(`backup:${normalizeBackupCode(code)}`, material)))
  await queryBatch([
    { sql: 'DELETE FROM desk_backup_codes' },
    ...hashes.map((hash) => ({ sql: 'INSERT INTO desk_backup_codes (hash, used_at) VALUES ($1, 0)', params: [hash] })),
  ])
  return codes
}

/** Confirms the first code; only then does 2FA turn on. Shows backup codes once. */
export async function confirmEnrollment(code: string, trust: boolean): Promise<StepResult> {
  const checked = await guard()
  if ('ok' in checked) return checked
  const { material } = checked
  const row = await stateRow()
  if (!row || active(row)) return { ok: false, reason: 'expired' }
  let secret: string
  try {
    secret = await secretOf(row, material)
  } catch (error) {
    return { ok: false, reason: 'unavailable', message: error instanceof Error ? error.message : undefined }
  }
  const step = await matchTotp(secret, code, Date.now())
  if (step === null) return miss()
  const now = Date.now()
  await query(
    'UPDATE desk_2fa SET active = 1, last_step = $1, enrolled_at = $2 WHERE id = 1 AND active = 0',
    [step, now],
  )
  const backupCodes = await replaceBackupCodes(material)
  await finish(material, trust)
  return { ok: true, backupCodes }
}

/** The second step: an authenticator code, or one unused backup code. */
export async function verifySecondStep(code: string, trust: boolean): Promise<StepResult> {
  const checked = await guard()
  if ('ok' in checked) return checked
  const { material } = checked
  const row = await stateRow()
  if (!row || !active(row)) return { ok: false, reason: 'expired' }
  if (looksLikeBackupCode(code)) {
    const hash = await keyedHash(`backup:${normalizeBackupCode(code)}`, material)
    const used = await query<{ hash: string }>(
      'UPDATE desk_backup_codes SET used_at = $1 WHERE hash = $2 AND used_at = 0 RETURNING hash',
      [Date.now(), hash],
    )
    if (used.length === 0) return miss()
    await finish(material, trust)
    return { ok: true }
  }
  let secret: string
  try {
    secret = await secretOf(row, material)
  } catch (error) {
    return { ok: false, reason: 'unavailable', message: error instanceof Error ? error.message : undefined }
  }
  const step = await matchTotp(secret, code, Date.now(), Number(row.last_step))
  if (step === null) return miss()
  // Only the first use of a step counts, so one code cannot open two sessions.
  const claimed = await query<{ id: unknown }>(
    'UPDATE desk_2fa SET last_step = $1 WHERE id = 1 AND last_step < $1 RETURNING id',
    [step],
  )
  if (claimed.length === 0) return miss()
  await finish(material, trust)
  return { ok: true }
}

// --- Desk → Security (signed in) ------------------------------------------------------

export type SecurityStatus = {
  active: boolean
  enrolledAt: number
  backupLeft: number
  keyReady: boolean
  devices: { id: string; label: string; createdAt: number; expiresAt: number; current: boolean }[]
}

export async function securityStatus(): Promise<SecurityStatus> {
  const material = keyMaterial()
  const row = await stateRow()
  const [codes = [], devices = []] = (await queryBatch([
    { sql: 'SELECT COUNT(*) AS left FROM desk_backup_codes WHERE used_at = 0' },
    { sql: 'SELECT hash, label, created_at, expires_at FROM desk_trusted WHERE expires_at > $1 ORDER BY created_at DESC', params: [Date.now()] },
  ])) as [{ left: unknown }[], { hash: string; label: string; created_at: unknown; expires_at: unknown }[]]
  const mine = material ? await trustedHash(material) : null
  return {
    active: active(row),
    enrolledAt: Number(row?.enrolled_at ?? 0),
    backupLeft: Number(codes[0]?.left ?? 0),
    keyReady: Boolean(material),
    devices: devices.map((device) => ({
      id: device.hash.slice(0, 16),
      label: device.label,
      createdAt: Number(device.created_at),
      expiresAt: Number(device.expires_at),
      current: device.hash === mine,
    })),
  }
}

/** New backup codes (the old set stops working). Needs a current app code. */
export async function regenerateBackupCodes(code: string): Promise<{ ok: true; codes: string[] } | { ok: false; error: string }> {
  const material = keyMaterial()
  if (!material) return { ok: false, error: 'Two-step sign-in is not ready.' }
  if (await lockedOut(clientKey(), Date.now())) return { ok: false, error: 'Too many tries. Wait 15 minutes and try again.' }
  const row = await stateRow()
  if (!row || !active(row)) return { ok: false, error: 'Two-step sign-in is not on yet.' }
  const step = await matchTotp(await secretOf(row, material), code, Date.now(), Number(row.last_step))
  if (step === null) {
    await noteMiss(clientKey(), Date.now())
    await slowDown()
    return { ok: false, error: 'That code did not match. Use the current code from your app.' }
  }
  await query('UPDATE desk_2fa SET last_step = $1 WHERE id = 1', [step])
  return { ok: true, codes: await replaceBackupCodes(material) }
}

export async function revokeDevice(id: string): Promise<void> {
  await ensureTables()
  const clean = id.replace(/[^0-9a-f]/g, '').slice(0, 16)
  if (clean.length !== 16) throw new Error('That device is not on the list.')
  await query(`DELETE FROM desk_trusted WHERE substr(hash, 1, 16) = $1`, [clean])
}

export async function revokeAllDevices(): Promise<void> {
  await ensureTables()
  await query('DELETE FROM desk_trusted')
  deleteCookie(TRUST_COOKIE, { path: '/' })
}

// --- Moving to a new phone (signed in) ---------------------------------------------

/**
 * Proves the person at the Desk still has the second factor: a current app
 * code, or an unused backup code (which is then used up).
 */
async function proveSecondFactor(material: string, code: string): Promise<boolean> {
  const row = await stateRow()
  if (!row || !active(row)) return false
  if (looksLikeBackupCode(code)) {
    const hash = await keyedHash(`backup:${normalizeBackupCode(code)}`, material)
    const used = await query<{ hash: string }>(
      'UPDATE desk_backup_codes SET used_at = $1 WHERE hash = $2 AND used_at = 0 RETURNING hash',
      [Date.now(), hash],
    )
    return used.length > 0
  }
  const step = await matchTotp(await secretOf(row, material), code, Date.now(), Number(row.last_step))
  if (step === null) return false
  await query('UPDATE desk_2fa SET last_step = $1 WHERE id = 1', [step])
  return true
}

/** Step 1 of a new phone: prove the old factor, get a new QR code (kept as id 2 until confirmed). */
export async function beginPhoneChange(
  code: string,
): Promise<{ ok: true; qrSvg: string; secret: string } | { ok: false; error: string }> {
  const material = keyMaterial()
  if (!material) return { ok: false, error: 'Two-step sign-in is not ready.' }
  if (await lockedOut(clientKey(), Date.now())) return { ok: false, error: 'Too many tries. Wait 15 minutes and try again.' }
  if (!(await proveSecondFactor(material, code))) {
    await noteMiss(clientKey(), Date.now())
    await slowDown()
    return { ok: false, error: 'That code did not match. Use a current app code or an unused backup code.' }
  }
  const secret = newTotpSecret()
  await query(
    `INSERT INTO desk_2fa (id, secret_enc, key_check, active, last_step, enrolled_at)
     VALUES (2, $1, $2, 0, 0, 0)
     ON CONFLICT (id) DO UPDATE SET secret_enc = EXCLUDED.secret_enc, key_check = EXCLUDED.key_check`,
    [await encryptSecret(secret, material), await keyedHash('key-check', material)],
  )
  return {
    ok: true,
    qrSvg: renderSVG(otpauthUrl(secret), { border: 2, ecc: 'M', pixelSize: 6, whiteColor: '#ffffff', blackColor: '#000000' }),
    secret: groupSecret(secret),
  }
}

/** Step 2: a code from the new phone switches over; the old phone stops working. */
export async function finishPhoneChange(code: string): Promise<{ ok: true } | { ok: false; error: string }> {
  const material = keyMaterial()
  if (!material) return { ok: false, error: 'Two-step sign-in is not ready.' }
  if (await lockedOut(clientKey(), Date.now())) return { ok: false, error: 'Too many tries. Wait 15 minutes and try again.' }
  const rows = await query<Row>('SELECT secret_enc, key_check, active, last_step, enrolled_at FROM desk_2fa WHERE id = 2')
  const pending = rows.at(0)
  if (!pending) return { ok: false, error: 'Start again: enter a code to set up the new phone.' }
  const step = await matchTotp(await secretOf(pending, material), code, Date.now())
  if (step === null) {
    await noteMiss(clientKey(), Date.now())
    await slowDown()
    return { ok: false, error: 'That code did not match. Use the code from the new phone.' }
  }
  await queryBatch([
    {
      sql: 'UPDATE desk_2fa SET secret_enc = $1, key_check = $2, last_step = $3, enrolled_at = $4 WHERE id = 1',
      params: [pending.secret_enc, pending.key_check, step, Date.now()],
    },
    { sql: 'DELETE FROM desk_2fa WHERE id = 2' },
  ])
  return { ok: true }
}

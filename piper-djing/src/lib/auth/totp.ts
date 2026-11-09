/**
 * Authenticator-app codes (TOTP, RFC 6238: SHA-1, 6 digits, 30 seconds),
 * built on Web Crypto so it runs the same in the Worker and in Node.
 */

const ALPHABET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567'

export const TOTP_STEP_SECONDS = 30

export function base32Encode(bytes: Uint8Array): string {
  let bits = 0
  let value = 0
  let out = ''
  for (const byte of bytes) {
    value = (value << 8) | byte
    bits += 8
    while (bits >= 5) {
      out += ALPHABET[(value >>> (bits - 5)) & 31]
      bits -= 5
    }
  }
  if (bits > 0) out += ALPHABET[(value << (5 - bits)) & 31]
  return out
}

export function base32Decode(text: string): Uint8Array {
  const clean = text.toUpperCase().replace(/[^A-Z2-7]/g, '')
  let bits = 0
  let value = 0
  const out: number[] = []
  for (const char of clean) {
    value = (value << 5) | ALPHABET.indexOf(char)
    bits += 5
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 255)
      bits -= 8
    }
  }
  return new Uint8Array(out)
}

export function randomBytesWeb(length: number): Uint8Array {
  const bytes = new Uint8Array(length)
  crypto.getRandomValues(bytes)
  return bytes
}

/** A new 160-bit secret, as base32. */
export function newTotpSecret(): string {
  return base32Encode(randomBytesWeb(20))
}

/** The secret in groups of four, for typing into an app by hand. */
export function groupSecret(secret: string): string {
  return secret.replace(/(.{4})/g, '$1 ').trim()
}

export function otpauthUrl(secret: string, account = 'Piper Desk', issuer = 'DJ Piper P'): string {
  const label = encodeURIComponent(`${issuer}:${account}`)
  return `otpauth://totp/${label}?secret=${secret}&issuer=${encodeURIComponent(issuer)}&algorithm=SHA1&digits=6&period=${TOTP_STEP_SECONDS}`
}

function counterBytes(counter: number): Uint8Array {
  const bytes = new Uint8Array(8)
  let rest = counter
  for (let i = 7; i >= 0; i -= 1) {
    bytes[i] = rest & 255
    rest = Math.floor(rest / 256)
  }
  return bytes
}

export async function hotp(secret: string, counter: number): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    base32Decode(secret),
    { name: 'HMAC', hash: 'SHA-1' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, counterBytes(counter)))
  const offset = (mac[19] ?? 0) & 15
  const number =
    (((mac[offset] ?? 0) & 127) << 24) |
    ((mac[offset + 1] ?? 0) << 16) |
    ((mac[offset + 2] ?? 0) << 8) |
    (mac[offset + 3] ?? 0)
  return String(number % 1_000_000).padStart(6, '0')
}

export function stepAt(now: number): number {
  return Math.floor(now / 1000 / TOTP_STEP_SECONDS)
}

/**
 * The time step a code belongs to, allowing one step either side for clock
 * drift, or null when it matches none. Steps at or before `after` are refused,
 * so a code that was already used cannot be used again.
 */
export async function matchTotp(
  secret: string,
  code: string,
  now: number,
  after = -1,
): Promise<number | null> {
  const digits = code.replace(/\s/g, '')
  if (!/^\d{6}$/.test(digits)) return null
  const current = stepAt(now)
  for (const step of [current - 1, current, current + 1]) {
    if (step <= after) continue
    if (safeEqual(await hotp(secret, step), digits)) return step
  }
  return null
}

export function safeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false
  let diff = 0
  for (let i = 0; i < a.length; i += 1) diff |= a.charCodeAt(i) ^ b.charCodeAt(i)
  return diff === 0
}

// --- Backup codes ---------------------------------------------------------------

const CODE_ALPHABET = 'abcdefghjkmnpqrstuvwxyz23456789'

/** Ten single-use codes like "k7mq-2xpd" (about 40 bits each). */
export function newBackupCodes(count = 10): string[] {
  return Array.from({ length: count }, () => {
    const bytes = randomBytesWeb(8)
    const chars = [...bytes].map((byte) => CODE_ALPHABET[byte % CODE_ALPHABET.length]).join('')
    return `${chars.slice(0, 4)}-${chars.slice(4, 8)}`
  })
}

export function normalizeBackupCode(code: string): string {
  return code.toLowerCase().replace(/[^a-z0-9]/g, '')
}

export function looksLikeBackupCode(code: string): boolean {
  return /^[a-z0-9]{8}$/.test(normalizeBackupCode(code)) && !/^\d{8}$/.test(normalizeBackupCode(code))
}

// --- Keys, encryption and hashing -------------------------------------------------

function toBase64(bytes: Uint8Array): string {
  let text = ''
  for (const byte of bytes) text += String.fromCharCode(byte)
  return btoa(text)
}

function fromBase64(text: string): Uint8Array {
  const raw = atob(text)
  const bytes = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i += 1) bytes[i] = raw.charCodeAt(i)
  return bytes
}

async function keyBytes(material: string, purpose: string): Promise<ArrayBuffer> {
  return crypto.subtle.digest('SHA-256', new TextEncoder().encode(`piper-desk-2fa:${purpose}:${material}`))
}

/** AES-256-GCM with a random IV; the stored text is base64(iv + ciphertext). */
export async function encryptSecret(plain: string, material: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', await keyBytes(material, 'secret'), 'AES-GCM', false, ['encrypt'])
  const iv = randomBytesWeb(12)
  const sealed = new Uint8Array(
    await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plain)),
  )
  const out = new Uint8Array(iv.length + sealed.length)
  out.set(iv)
  out.set(sealed, iv.length)
  return toBase64(out)
}

export async function decryptSecret(stored: string, material: string): Promise<string> {
  const bytes = fromBase64(stored)
  const key = await crypto.subtle.importKey('raw', await keyBytes(material, 'secret'), 'AES-GCM', false, ['decrypt'])
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: bytes.slice(0, 12) }, key, bytes.slice(12))
  return new TextDecoder().decode(plain)
}

/** A keyed hash (HMAC-SHA-256, hex) for backup codes and device tokens. */
export async function keyedHash(value: string, material: string): Promise<string> {
  const key = await crypto.subtle.importKey(
    'raw',
    await keyBytes(material, 'hash'),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const mac = new Uint8Array(await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(value)))
  return [...mac].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

export function randomToken(): string {
  return [...randomBytesWeb(32)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

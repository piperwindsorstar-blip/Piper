import { randomBytes } from 'node:crypto'
import { query } from '../db.server.ts'
import { sampleWedding } from './demo.ts'
import { blankWedding, coupleSlug, parseWedding, quoteRsvp } from './model.ts'
import type { PriceQuote, RsvpWedding } from './model.ts'

const TABLE = `
CREATE TABLE IF NOT EXISTS rsvp_weddings (
  slug text PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  paid integer NOT NULL DEFAULT 0,
  sample integer NOT NULL DEFAULT 0,
  price_cents integer NOT NULL DEFAULT 3000,
  body text NOT NULL DEFAULT '{}'
)`

const ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

function flag(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === 'true' ||
    value === 't'
  )
}

function whole(value: unknown): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number)) return 0
  return Math.round(number)
}

export async function ensureRsvp(): Promise<void> {
  await query(TABLE)
  await query(
    'CREATE INDEX IF NOT EXISTS rsvp_weddings_email ON rsvp_weddings (lower(email))',
  )
}

export function newToken(): string {
  return randomBytes(9).toString('base64url')
}

export function newInviteCode(): string {
  const bytes = randomBytes(6)
  let code = ''
  for (const byte of bytes) code += ALPHABET[byte % ALPHABET.length] ?? 'R'
  return code
}

export async function readRsvp(slug: string): Promise<RsvpWedding | null> {
  const clean = slug.trim().toLowerCase()
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(clean)) return null
  await ensureRsvp()
  const rows = await query<{ body: string }>(
    'SELECT body FROM rsvp_weddings WHERE slug = $1',
    [clean],
  )
  if (rows.length === 0) return null
  try {
    return parseWedding(JSON.parse(rows[0].body) as unknown, clean)
  } catch {
    return null
  }
}

export async function writeRsvp(wedding: RsvpWedding): Promise<void> {
  await ensureRsvp()
  await query(
    `INSERT INTO rsvp_weddings (slug, email, paid, sample, price_cents, body)
     VALUES ($1, $2, $3, $4, $5, $6)
     ON CONFLICT (slug) DO UPDATE SET
       email = EXCLUDED.email,
       paid = EXCLUDED.paid,
       sample = EXCLUDED.sample,
       price_cents = EXCLUDED.price_cents,
       body = EXCLUDED.body`,
    [
      wedding.slug,
      wedding.email,
      wedding.paid ? 1 : 0,
      wedding.sample ? 1 : 0,
      wedding.priceCents,
      JSON.stringify(wedding),
    ],
  )
}

export async function listRsvps(): Promise<RsvpWedding[]> {
  await ensureRsvp()
  const rows = await query<{ slug: string; body: string }>(
    'SELECT slug, body FROM rsvp_weddings ORDER BY slug',
  )
  return rows.flatMap((row) => {
    try {
      const wedding = parseWedding(JSON.parse(row.body) as unknown, row.slug)
      return wedding ? [wedding] : []
    } catch {
      return []
    }
  })
}

export async function deleteRsvp(slug: string): Promise<void> {
  await ensureRsvp()
  await query('DELETE FROM rsvp_weddings WHERE slug = $1', [slug])
}

export async function quoteRsvpPrice(email: string): Promise<PriceQuote> {
  const rows = await query<{
    email: string
    sample: unknown
    status: string
    received_cents: unknown
  }>(
    `SELECT bookings.email AS email, bookings.sample AS sample, bookings.status AS status,
      (SELECT received_cents FROM invoices WHERE invoices.booking_id = bookings.id) AS received_cents
     FROM bookings`,
  )
  return quoteRsvp(
    email,
    rows.map((row) => ({
      email: row.email,
      sample: flag(row.sample),
      status: row.status,
      receivedCents: whole(row.received_cents),
    })),
  )
}

export async function createRsvpWedding(input: {
  partnerOne: string
  partnerTwo: string
  email: string
  eventDate: string
  venue: string
}): Promise<RsvpWedding> {
  const quote = await quoteRsvpPrice(input.email)
  const base = coupleSlug(input.partnerOne, input.partnerTwo)
  let slug = base
  for (let extra = 2; extra < 40; extra += 1) {
    const existing = await readRsvp(slug)
    if (!existing) break
    slug = `${base}-${extra}`
  }
  const wedding = blankWedding({
    slug,
    partnerOne: input.partnerOne,
    partnerTwo: input.partnerTwo,
    email: input.email,
    eventDate: input.eventDate,
    venue: input.venue,
    priceCents: quote.cents,
    priceKind: quote.kind,
    inviteCode: newInviteCode(),
  })
  wedding.slug = slug
  await writeRsvp(wedding)
  return wedding
}

export async function ensureSampleRsvp(): Promise<RsvpWedding> {
  const existing = await readRsvp('sarah-and-michael')
  if (existing) return existing
  const wedding = sampleWedding()
  await writeRsvp(wedding)
  return wedding
}

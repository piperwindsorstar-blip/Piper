import { randomBytes } from 'node:crypto'
import { query, queryBatch } from '../db.server.ts'
import { sampleWedding } from './demo.ts'
import { blankWedding, coupleSlug, parseWedding, quoteRsvp } from './model.ts'
import type { CoupleBooking, PriceQuote, RsvpWedding } from './model.ts'
import { chunkBase64, decodeBase64, encodeBase64, joinBase64 } from './photo.ts'
import type { PhotoShape, RsvpPhoto } from './templates.ts'
import { parseCrop, parsePhotoShape } from './templates.ts'
import type { CoupleQuestion } from './questions.ts'

const TABLE = `
CREATE TABLE IF NOT EXISTS rsvp_weddings (
  slug text PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  paid integer NOT NULL DEFAULT 0,
  sample integer NOT NULL DEFAULT 0,
  price_cents integer NOT NULL DEFAULT 3000,
  body text NOT NULL DEFAULT '{}'
)`

const PHOTOS = `
CREATE TABLE IF NOT EXISTS rsvp_photos (
  slug text PRIMARY KEY,
  mime text NOT NULL,
  shape text NOT NULL DEFAULT 'full',
  version text NOT NULL,
  width integer NOT NULL DEFAULT 0,
  height integer NOT NULL DEFAULT 0,
  bytes integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL
)`

const PHOTO_PARTS = `
CREATE TABLE IF NOT EXISTS rsvp_photo_parts (
  slug text NOT NULL,
  idx integer NOT NULL,
  data text NOT NULL,
  PRIMARY KEY (slug, idx)
)`

/** The shaped rendition: the same photo with a banner, circle or arch crop. */
const PHOTO_CROPS = `
CREATE TABLE IF NOT EXISTS rsvp_photo_crops (
  slug text PRIMARY KEY,
  shape text NOT NULL,
  version text NOT NULL,
  bytes integer NOT NULL DEFAULT 0,
  updated_at text NOT NULL
)`

const PHOTO_CROP_PARTS = `
CREATE TABLE IF NOT EXISTS rsvp_photo_crop_parts (
  slug text NOT NULL,
  idx integer NOT NULL,
  data text NOT NULL,
  PRIMARY KEY (slug, idx)
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
  await ensureRsvpDesk()
  await removeRsvpPhoto(slug)
  await query('DELETE FROM rsvp_questions WHERE slug = $1', [slug])
  await query('DELETE FROM rsvp_weddings WHERE slug = $1', [slug])
}

const QUESTIONS = `
CREATE TABLE IF NOT EXISTS rsvp_questions (
  id text PRIMARY KEY,
  slug text NOT NULL,
  couple text NOT NULL DEFAULT '',
  question text NOT NULL,
  asked_at text NOT NULL,
  reply text NOT NULL DEFAULT '',
  replied_at text NOT NULL DEFAULT ''
)`

type QuestionRow = {
  id: string
  slug: string
  couple: string
  question: string
  asked_at: string
  reply: string
  replied_at: string
}

async function ensureRsvpDesk(): Promise<void> {
  await ensureRsvp()
  await query(QUESTIONS)
  await query(
    'CREATE INDEX IF NOT EXISTS rsvp_questions_slug ON rsvp_questions (slug)',
  )
}

function questionFrom(row: QuestionRow): CoupleQuestion {
  return {
    id: row.id,
    rsvpId: row.slug,
    couple: row.couple,
    text: row.question,
    askedAt: row.asked_at,
    reply: row.reply,
    repliedAt: row.replied_at,
  }
}

export async function listCoupleQuestions(
  slug?: string,
  openOnly = false,
): Promise<CoupleQuestion[]> {
  await ensureRsvpDesk()
  const columns = 'id, slug, couple, question, asked_at, reply, replied_at'
  if (slug) {
    const rows = await query<QuestionRow>(
      `SELECT ${columns} FROM rsvp_questions WHERE slug = $1 ORDER BY asked_at`,
      [slug],
    )
    return rows.map(questionFrom)
  }
  const rows = await query<QuestionRow>(
    openOnly
      ? `SELECT ${columns} FROM rsvp_questions WHERE trim(reply) = '' ORDER BY asked_at`
      : `SELECT ${columns} FROM rsvp_questions ORDER BY asked_at`,
  )
  return rows.map(questionFrom)
}

export async function insertCoupleQuestion(input: {
  slug: string
  couple: string
  text: string
  askedAt: string
}): Promise<CoupleQuestion> {
  await ensureRsvpDesk()
  const question: CoupleQuestion = {
    id: newToken(),
    rsvpId: input.slug,
    couple: input.couple,
    text: input.text,
    askedAt: input.askedAt,
    reply: '',
    repliedAt: '',
  }
  await query(
    `INSERT INTO rsvp_questions (id, slug, couple, question, asked_at, reply, replied_at)
     VALUES ($1, $2, $3, $4, $5, '', '')`,
    [
      question.id,
      question.rsvpId,
      question.couple,
      question.text,
      question.askedAt,
    ],
  )
  return question
}

export async function replyCoupleQuestion(
  slug: string,
  id: string,
  text: string,
  repliedAt: string,
): Promise<CoupleQuestion | null> {
  await ensureRsvpDesk()
  const found = await query<{ id: string }>(
    'SELECT id FROM rsvp_questions WHERE id = $1 AND slug = $2',
    [id, slug],
  )
  if (found.length === 0) return null
  await query(
    'UPDATE rsvp_questions SET reply = $1, replied_at = $2 WHERE id = $3 AND slug = $4',
    [text, repliedAt, id, slug],
  )
  const rows = await query<QuestionRow>(
    `SELECT id, slug, couple, question, asked_at, reply, replied_at
     FROM rsvp_questions WHERE id = $1 AND slug = $2`,
    [id, slug],
  )
  if (rows.length === 0) return null
  return questionFrom(rows[0])
}

export async function coupleBookings(): Promise<CoupleBooking[]> {
  const rows = await query<{
    partner_one: string
    partner_two: string
    email: string
    event_date: string
    sample: unknown
  }>('SELECT partner_one, partner_two, email, event_date, sample FROM bookings')
  return rows.map((row) => ({
    partnerOne: row.partner_one,
    partnerTwo: row.partner_two,
    email: row.email,
    eventDate: row.event_date,
    sample: flag(row.sample),
  }))
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
  wedding.replyEmail = input.email.trim().slice(0, 120)
  await writeRsvp(wedding)
  return wedding
}

// --- the couple's photo, kept in the site's own storage --------------------

export async function ensureRsvpPhotos(): Promise<void> {
  await ensureRsvp()
  await query(PHOTOS)
  await query(PHOTO_PARTS)
  await query(PHOTO_CROPS)
  await query(PHOTO_CROP_PARTS)
  await ensurePhotoColumns()
}

/**
 * A photo table written before the couple could reposition a crop has no
 * position columns yet, so they are added once and existing rows keep the
 * centre of the photo.
 */
async function ensurePhotoColumns(): Promise<void> {
  for (const [name, definition] of [
    ['crop_zoom', 'integer NOT NULL DEFAULT 1'],
    ['crop_pan_x', 'integer NOT NULL DEFAULT 0'],
    ['crop_pan_y', 'integer NOT NULL DEFAULT 0'],
    ['crop_shape', "text NOT NULL DEFAULT ''"],
    ['crop_version', "text NOT NULL DEFAULT ''"],
  ] as const) {
    try {
      await query(`SELECT ${name} FROM rsvp_photos LIMIT 0`)
    } catch {
      try {
        await query(`ALTER TABLE rsvp_photos ADD COLUMN ${name} ${definition}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!/duplicate column|already exists/i.test(message)) throw error
      }
    }
  }
}

type PhotoRow = {
  slug: string
  mime: string
  shape: string
  version: string
  width: unknown
  height: unknown
  bytes: unknown
  crop_zoom: unknown
  crop_pan_x: unknown
  crop_pan_y: unknown
  crop_shape: unknown
  crop_version: unknown
  updated_at: string
}

/**
 * Stores the trimmed JPEG the browser produced. The base64 is written in rows,
 * so a photo never has to fit in one row on either database.
 */
export async function saveRsvpPhoto(input: {
  slug: string
  mime: string
  bytes: Uint8Array
  shape: string
  width: number
  height: number
  crop?: { zoom: number; panX: number; panY: number }
  /** The shaped rendition, when the couple chose a crop rather than the whole photo. */
  cropBytes?: Uint8Array
}): Promise<RsvpPhoto> {
  await ensureRsvpPhotos()
  const slug = input.slug.trim().toLowerCase()
  const version = String(Date.now())
  const shape = parsePhotoShape(input.shape)
  const crop = parseCrop(input.crop)
  const cropVersion = input.cropBytes ? version : ''
  const rows = chunkBase64(encodeBase64(input.bytes))
  const statements = [
    { sql: 'DELETE FROM rsvp_photo_parts WHERE slug = $1', params: [slug] },
    ...rows.map((data, index) => ({
      sql: 'INSERT INTO rsvp_photo_parts (slug, idx, data) VALUES ($1, $2, $3)',
      params: [slug, index, data],
    })),
    {
      sql: `INSERT INTO rsvp_photos
              (slug, mime, shape, version, width, height, bytes, updated_at,
               crop_zoom, crop_pan_x, crop_pan_y, crop_shape, crop_version)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
            ON CONFLICT (slug) DO UPDATE SET
              mime = EXCLUDED.mime,
              shape = EXCLUDED.shape,
              version = EXCLUDED.version,
              width = EXCLUDED.width,
              height = EXCLUDED.height,
              bytes = EXCLUDED.bytes,
              updated_at = EXCLUDED.updated_at,
              crop_zoom = EXCLUDED.crop_zoom,
              crop_pan_x = EXCLUDED.crop_pan_x,
              crop_pan_y = EXCLUDED.crop_pan_y,
              crop_shape = EXCLUDED.crop_shape,
              crop_version = EXCLUDED.crop_version`,
      params: [
        slug,
        input.mime,
        shape,
        version,
        Math.round(input.width),
        Math.round(input.height),
        input.bytes.length,
        new Date().toISOString(),
        Math.round(crop.zoom * 1000),
        Math.round(crop.panX * 1000),
        Math.round(crop.panY * 1000),
        cropVersion ? shape : '',
        cropVersion,
      ],
    },
  ]
  if (input.cropBytes) {
    const cropRows = chunkBase64(encodeBase64(input.cropBytes))
    statements.push(
      {
        sql: 'DELETE FROM rsvp_photo_crop_parts WHERE slug = $1',
        params: [slug],
      },
      ...cropRows.map((data, index) => ({
        sql: 'INSERT INTO rsvp_photo_crop_parts (slug, idx, data) VALUES ($1, $2, $3)',
        params: [slug, index, data],
      })),
      {
        sql: `INSERT INTO rsvp_photo_crops
                (slug, shape, version, bytes, updated_at)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (slug) DO UPDATE SET
                shape = EXCLUDED.shape,
                version = EXCLUDED.version,
                bytes = EXCLUDED.bytes,
                updated_at = EXCLUDED.updated_at`,
        params: [
          slug,
          shape,
          cropVersion,
          input.cropBytes.length,
          new Date().toISOString(),
        ],
      },
    )
  } else {
    statements.push(
      {
        sql: 'DELETE FROM rsvp_photo_crop_parts WHERE slug = $1',
        params: [slug],
      },
      { sql: 'DELETE FROM rsvp_photo_crops WHERE slug = $1', params: [slug] },
    )
  }
  await queryBatch(statements)
  return {
    shape,
    version,
    width: Math.round(input.width),
    height: Math.round(input.height),
    bytes: input.bytes.length,
    cropVersion,
    crop,
  }
}

/**
 * The couple moved the crop, or picked a different shape, without uploading
 * again. The whole photo stays put; only the position and the rendition change.
 */
export async function saveRsvpPhotoCrop(input: {
  slug: string
  shape: string
  crop: { zoom: number; panX: number; panY: number }
  /** The new shaped rendition. Omitted for the whole photo, which needs none. */
  cropBytes?: Uint8Array
}): Promise<RsvpPhoto | null> {
  await ensureRsvpPhotos()
  const slug = input.slug.trim().toLowerCase()
  const rows = await query<PhotoRow>(
    'SELECT * FROM rsvp_photos WHERE slug = $1',
    [slug],
  )
  if (rows.length === 0) return null
  const row = rows[0]
  const shape = parsePhotoShape(input.shape)
  const crop = parseCrop(input.crop)
  const version = String(Date.now())
  const cropVersion = input.cropBytes ? version : ''
  const statements = []
  if (input.cropBytes) {
    const cropRows = chunkBase64(encodeBase64(input.cropBytes))
    statements.push(
      {
        sql: 'DELETE FROM rsvp_photo_crop_parts WHERE slug = $1',
        params: [slug],
      },
      ...cropRows.map((data, index) => ({
        sql: 'INSERT INTO rsvp_photo_crop_parts (slug, idx, data) VALUES ($1, $2, $3)',
        params: [slug, index, data],
      })),
      {
        sql: `INSERT INTO rsvp_photo_crops
                (slug, shape, version, bytes, updated_at)
              VALUES ($1, $2, $3, $4, $5)
              ON CONFLICT (slug) DO UPDATE SET
                shape = EXCLUDED.shape,
                version = EXCLUDED.version,
                bytes = EXCLUDED.bytes,
                updated_at = EXCLUDED.updated_at`,
        params: [
          slug,
          shape,
          cropVersion,
          input.cropBytes.length,
          new Date().toISOString(),
        ],
      },
    )
  } else {
    statements.push(
      {
        sql: 'DELETE FROM rsvp_photo_crop_parts WHERE slug = $1',
        params: [slug],
      },
      { sql: 'DELETE FROM rsvp_photo_crops WHERE slug = $1', params: [slug] },
    )
  }
  statements.push({
    sql: `UPDATE rsvp_photos SET
            shape = $2,
            crop_zoom = $3,
            crop_pan_x = $4,
            crop_pan_y = $5,
            crop_shape = $6,
            crop_version = $7,
            updated_at = $8
          WHERE slug = $1`,
    params: [
      slug,
      shape,
      Math.round(crop.zoom * 1000),
      Math.round(crop.panX * 1000),
      Math.round(crop.panY * 1000),
      cropVersion ? shape : '',
      cropVersion,
      new Date().toISOString(),
    ],
  })
  await queryBatch(statements)
  return {
    shape,
    version: row.version,
    width: whole(row.width),
    height: whole(row.height),
    bytes: whole(row.bytes),
    cropVersion,
    crop,
  }
}

export async function readRsvpPhotoMeta(slug: string): Promise<{
  mime: string
  shape: PhotoShape
  version: string
  width: number
  height: number
  bytes: number
  cropVersion: string
  crop: { zoom: number; panX: number; panY: number }
} | null> {
  await ensureRsvpPhotos()
  const rows = await query<PhotoRow>(
    'SELECT * FROM rsvp_photos WHERE slug = $1',
    [slug.trim().toLowerCase()],
  )
  if (rows.length === 0) return null
  const row = rows[0]
  return {
    mime: row.mime,
    shape: parsePhotoShape(row.shape),
    version: row.version,
    width: whole(row.width),
    height: whole(row.height),
    bytes: whole(row.bytes),
    cropVersion: typeof row.crop_version === 'string' ? row.crop_version : '',
    crop: {
      zoom: whole(row.crop_zoom) / 1000 || 1,
      panX: whole(row.crop_pan_x) / 1000,
      panY: whole(row.crop_pan_y) / 1000,
    },
  }
}

/** The whole photo, reassembled from its rows. Nothing is ever trimmed here. */
export async function readRsvpPhoto(
  slug: string,
): Promise<{ mime: string; version: string; bytes: Uint8Array } | null> {
  const meta = await readRsvpPhotoMeta(slug)
  if (!meta) return null
  const rows = await query<{ data: string }>(
    'SELECT data FROM rsvp_photo_parts WHERE slug = $1 ORDER BY idx',
    [slug.trim().toLowerCase()],
  )
  if (rows.length === 0) return null
  const bytes = decodeBase64(joinBase64(rows.map((row) => row.data)))
  if (!bytes || bytes.length === 0) return null
  return { mime: meta.mime, version: meta.version, bytes }
}

/** The shaped rendition, or null when the photo has no crop stored. */
export async function readRsvpPhotoCrop(slug: string): Promise<{
  mime: string
  shape: PhotoShape
  version: string
  bytes: Uint8Array
} | null> {
  const meta = await readRsvpPhotoMeta(slug)
  if (!meta || !meta.cropVersion) return null
  const rows = await query<{ data: string }>(
    'SELECT data FROM rsvp_photo_crop_parts WHERE slug = $1 ORDER BY idx',
    [slug.trim().toLowerCase()],
  )
  if (rows.length === 0) return null
  const bytes = decodeBase64(joinBase64(rows.map((row) => row.data)))
  if (!bytes || bytes.length === 0) return null
  return {
    mime: meta.mime,
    shape: meta.shape,
    version: meta.cropVersion,
    bytes,
  }
}

export async function removeRsvpPhoto(slug: string): Promise<void> {
  await ensureRsvpPhotos()
  const clean = slug.trim().toLowerCase()
  await query('DELETE FROM rsvp_photo_parts WHERE slug = $1', [clean])
  await query('DELETE FROM rsvp_photo_crop_parts WHERE slug = $1', [clean])
  await query('DELETE FROM rsvp_photo_crops WHERE slug = $1', [clean])
  await query('DELETE FROM rsvp_photos WHERE slug = $1', [clean])
}

export async function ensureSampleRsvp(): Promise<RsvpWedding> {
  const existing = await readRsvp('sarah-and-michael')
  if (existing) return existing
  const wedding = sampleWedding()
  await writeRsvp(wedding)
  return wedding
}

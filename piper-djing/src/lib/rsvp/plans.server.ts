import { query } from '../db.server.ts'
import { parseSeating } from './seating.ts'
import type { SeatingPlan } from './seating.ts'
import { parseTimeline } from './timeline.ts'
import type { Timeline } from './timeline.ts'

/**
 * The seating chart and the day's timeline each live in their own row, keyed
 * by the couple's RSVP slug. Keeping them out of the wedding record means a
 * guest reply saved at the same moment can never overwrite a seating change,
 * and every read and write is scoped to that one couple.
 */
const SEATING = `
CREATE TABLE IF NOT EXISTS rsvp_seating (
  slug text PRIMARY KEY,
  body text NOT NULL DEFAULT '{}',
  updated_at text NOT NULL DEFAULT ''
)`

const TIMELINE = `
CREATE TABLE IF NOT EXISTS rsvp_timeline (
  slug text PRIMARY KEY,
  body text NOT NULL DEFAULT '{}',
  updated_at text NOT NULL DEFAULT ''
)`

/** The couple's own venue layout, traced over on the floor plan. */
const FLOOR_IMAGE = `
CREATE TABLE IF NOT EXISTS rsvp_floor_image (
  slug text PRIMARY KEY,
  data text NOT NULL,
  updated_at text NOT NULL DEFAULT ''
)`

/** A downsized JPEG or PNG as a data URL; the browser shrinks it before upload. */
export const FLOOR_IMAGE_MAX = 1_500_000

let ready: Promise<void> | null = null

function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(SEATING)
      await query(TIMELINE)
      await query(FLOOR_IMAGE)
    })().catch((error: unknown) => {
      ready = null
      throw error
    })
  }
  return ready
}

type Row = { slug: string; body: string; updated_at: string }

function parsed<T>(body: string, parse: (raw: unknown) => T): T {
  try {
    return parse(JSON.parse(body) as unknown)
  } catch {
    return parse(null)
  }
}

async function readBody(table: string, slug: string): Promise<string | null> {
  await ensure()
  const rows = await query<Row>(
    `SELECT body FROM ${table} WHERE slug = $1`,
    [slug],
  )
  return rows[0]?.body ?? null
}

async function writeBody(table: string, slug: string, body: unknown) {
  await ensure()
  const savedAt = new Date().toISOString()
  await query(
    `INSERT INTO ${table} (slug, body, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET
       body = EXCLUDED.body,
       updated_at = EXCLUDED.updated_at`,
    [slug, JSON.stringify(body), savedAt],
  )
  return savedAt
}

export async function readSeating(slug: string): Promise<SeatingPlan> {
  const body = await readBody('rsvp_seating', slug)
  return parsed(body ?? '{}', parseSeating)
}

export async function writeSeating(
  slug: string,
  plan: SeatingPlan,
): Promise<string> {
  return writeBody('rsvp_seating', slug, plan)
}

export async function readTimeline(slug: string): Promise<Timeline> {
  const body = await readBody('rsvp_timeline', slug)
  return parsed(body ?? '{}', parseTimeline)
}

export async function writeTimeline(
  slug: string,
  timeline: Timeline,
): Promise<string> {
  return writeBody('rsvp_timeline', slug, timeline)
}

export async function readFloorImage(slug: string): Promise<string> {
  await ensure()
  const rows = await query<{ data: string }>(
    'SELECT data FROM rsvp_floor_image WHERE slug = $1',
    [slug],
  )
  return rows[0]?.data ?? ''
}

export async function writeFloorImage(slug: string, data: string) {
  await ensure()
  await query(
    `INSERT INTO rsvp_floor_image (slug, data, updated_at) VALUES ($1, $2, $3)
     ON CONFLICT (slug) DO UPDATE SET
       data = EXCLUDED.data,
       updated_at = EXCLUDED.updated_at`,
    [slug, data, new Date().toISOString()],
  )
}

export async function deleteFloorImage(slug: string) {
  await ensure()
  await query('DELETE FROM rsvp_floor_image WHERE slug = $1', [slug])
}

/** Every couple's timeline in one call, for the owner desk. */
export async function listTimelines(): Promise<Map<string, Timeline>> {
  await ensure()
  const rows = await query<Row>('SELECT slug, body FROM rsvp_timeline')
  return new Map(rows.map((row) => [row.slug, parsed(row.body, parseTimeline)]))
}

/** Clears both when a couple's RSVP is deleted. */
export async function deletePlans(slug: string): Promise<void> {
  await ensure()
  await query('DELETE FROM rsvp_seating WHERE slug = $1', [slug])
  await query('DELETE FROM rsvp_timeline WHERE slug = $1', [slug])
  await query('DELETE FROM rsvp_floor_image WHERE slug = $1', [slug])
}

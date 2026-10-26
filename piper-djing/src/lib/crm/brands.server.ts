import { query, queryBatch } from '../db.server.ts'
import { brandLogoUrl } from './brands.ts'
import type { DeskBrand, PublicBrand } from './brands.ts'
import { moved, vendorLogoData, vendorName, vendorWebsite } from './vendors.ts'

/**
 * Brands for the scrolling strip, kept in the Book so the desk can change the
 * home page and /weddings without a redeploy. Starts empty.
 */

const TABLE = `CREATE TABLE IF NOT EXISTS brands (
  id integer PRIMARY KEY,
  name text NOT NULL,
  href text NOT NULL DEFAULT '',
  mime text NOT NULL,
  logo text NOT NULL,
  shown integer NOT NULL DEFAULT 1,
  position integer NOT NULL,
  version integer NOT NULL DEFAULT 1
)`

let ready: Promise<void> | null = null

function ensureBrands(): Promise<void> {
  if (!ready) {
    ready = query(TABLE).then(
      () => undefined,
      (error: unknown) => {
        ready = null
        throw error
      },
    )
  }
  return ready
}

type BrandRow = {
  id: unknown
  name: string
  href: string
  shown: unknown
  version: unknown
}

const COLUMNS = 'id, name, href, shown, version'

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't' || value === 'true'
}

function deskBrand(row: BrandRow): DeskBrand {
  const id = num(row.id)
  return {
    id,
    name: row.name,
    href: row.href ? row.href : null,
    logo: brandLogoUrl(id, num(row.version)),
    shown: truthy(row.shown),
  }
}

/** An optional link: blank is fine, anything else must be https://. */
function brandLink(value: string | undefined): string {
  const raw = (value ?? '').trim()
  return raw ? vendorWebsite(raw) : ''
}

/** Visible brands in Piper's order, for the strip. One Book call once warm. */
export async function listPublicBrands(): Promise<PublicBrand[]> {
  await ensureBrands()
  const rows = await query<BrandRow>(
    `SELECT ${COLUMNS} FROM brands WHERE shown <> 0 ORDER BY position, id`,
  )
  return rows.map((row) => {
    const { id, name, href, logo } = deskBrand(row)
    return { id, name, href, logo }
  })
}

export async function listDeskBrands(): Promise<DeskBrand[]> {
  await ensureBrands()
  const rows = await query<BrandRow>(`SELECT ${COLUMNS} FROM brands ORDER BY position, id`)
  return rows.map(deskBrand)
}

export async function brandLogo(
  id: number,
): Promise<{ mime: string; logo: string; version: number } | null> {
  if (!Number.isInteger(id) || id < 1) return null
  await ensureBrands()
  const rows = await query<{ mime: string; logo: string; version: unknown }>(
    'SELECT mime, logo, version FROM brands WHERE id = $1',
    [id],
  )
  const row = rows.at(0)
  if (!row || !row.logo || !/^image\/(png|jpeg|webp)$/.test(row.mime)) return null
  return { mime: row.mime, logo: row.logo, version: num(row.version) }
}

async function brandExists(id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id < 1) return false
  return (await query('SELECT id FROM brands WHERE id = $1', [id])).length > 0
}

export async function addBrand(input: {
  name: string
  href?: string
  logo: string
  shown?: boolean
}): Promise<void> {
  await ensureBrands()
  const name = vendorName(input.name, 'The brand name')
  const href = brandLink(input.href)
  if (!input.logo?.trim()) throw new Error('Choose a logo.')
  const logo = vendorLogoData(input.logo)
  const [ids = []] = (await queryBatch([
    {
      sql: `SELECT COALESCE(MAX(id), 0) + 1 AS next, COALESCE(MAX(position), -1) + 1 AS position
            FROM brands`,
    },
  ])) as [{ next: unknown; position: unknown }[]]
  await query(
    `INSERT INTO brands (id, name, href, mime, logo, shown, position, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 1)`,
    [
      num(ids[0]?.next) || 1,
      name,
      href,
      logo.mime,
      logo.logo,
      input.shown === false ? 0 : 1,
      num(ids[0]?.position),
    ],
  )
}

export async function updateBrand(input: {
  id: number
  name: string
  href?: string
  /** A new logo, '' to keep the current one. */
  logo?: string
}): Promise<void> {
  await ensureBrands()
  if (!(await brandExists(input.id))) throw new Error('That brand is no longer on the list.')
  const name = vendorName(input.name, 'The brand name')
  const href = brandLink(input.href)
  const logo = input.logo?.trim() ? vendorLogoData(input.logo) : null
  await queryBatch([
    { sql: 'UPDATE brands SET name = $1, href = $2 WHERE id = $3', params: [name, href, input.id] },
    ...(logo
      ? [
          {
            sql: 'UPDATE brands SET mime = $1, logo = $2, version = version + 1 WHERE id = $3',
            params: [logo.mime, logo.logo, input.id],
          },
        ]
      : []),
  ])
}

export async function setBrandShown(id: number, shown: boolean): Promise<void> {
  await ensureBrands()
  if (!(await brandExists(id))) throw new Error('That brand is no longer on the list.')
  await query('UPDATE brands SET shown = $1 WHERE id = $2', [shown ? 1 : 0, id])
}

export async function removeBrand(id: number): Promise<void> {
  await ensureBrands()
  if (!Number.isInteger(id) || id < 1) throw new Error('That brand is no longer on the list.')
  await query('DELETE FROM brands WHERE id = $1', [id])
}

export async function moveBrand(id: number, direction: 'up' | 'down'): Promise<void> {
  await ensureBrands()
  const ids = (await query<{ id: unknown }>('SELECT id FROM brands ORDER BY position, id')).map(
    (row) => num(row.id),
  )
  if (!ids.includes(id)) throw new Error('That brand is no longer on the list.')
  await queryBatch(
    moved(ids, ids.indexOf(id), direction).map((brandId, position) => ({
      sql: 'UPDATE brands SET position = $1 WHERE id = $2',
      params: [position, brandId],
    })),
  )
}

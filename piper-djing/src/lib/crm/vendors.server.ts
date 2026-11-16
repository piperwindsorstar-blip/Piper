import { query, queryBatch } from '../db.server.ts'
import {
  STARTING_VENDOR_CATEGORIES,
  moved,
  publicVendorGroups,
  vendorLogoData,
  vendorLogoUrl,
  vendorName,
  vendorWebsite,
} from './vendors.ts'
import type {
  DeskVendor,
  DeskVendorCategory,
  PublicVendorGroup,
} from './vendors.ts'

/**
 * Vendors and their categories, kept in the Book so the desk can change the
 * public page without a redeploy. The starting categories are added once;
 * after that only the desk changes them, so a deleted one stays deleted.
 */

const TABLES = [
  `CREATE TABLE IF NOT EXISTS vendor_categories (
    id integer PRIMARY KEY,
    name text NOT NULL,
    position integer NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS vendors (
    id integer PRIMARY KEY,
    category_id integer NOT NULL,
    name text NOT NULL,
    href text NOT NULL,
    mime text NOT NULL DEFAULT '',
    logo text NOT NULL DEFAULT '',
    shown integer NOT NULL DEFAULT 1,
    position integer NOT NULL,
    version integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS vendor_setup (
    key text PRIMARY KEY
  )`,
]

let ready: Promise<void> | null = null

function ensureVendors(): Promise<void> {
  if (!ready) {
    ready = setUp().catch((error: unknown) => {
      ready = null
      throw error
    })
  }
  return ready
}

async function setUp(): Promise<void> {
  const results = await queryBatch([
    ...TABLES.map((sql) => ({ sql })),
    { sql: `SELECT key FROM vendor_setup WHERE key = 'categories'` },
  ])
  if ((results[TABLES.length] ?? []).length > 0) return
  await queryBatch([
    ...STARTING_VENDOR_CATEGORIES.map((name, index) => ({
      sql: `INSERT INTO vendor_categories (id, name, position) VALUES ($1, $2, $3)
            ON CONFLICT (id) DO NOTHING`,
      params: [index + 1, name, index],
    })),
    {
      sql: `INSERT INTO vendor_setup (key) VALUES ('categories') ON CONFLICT (key) DO NOTHING`,
    },
  ])
}

type CategoryRow = { id: unknown; name: string; position: unknown }
type VendorRow = {
  id: unknown
  category_id: unknown
  name: string
  href: string
  has_logo: unknown
  shown: unknown
  position: unknown
  version: unknown
}

const CATEGORY_SQL =
  'SELECT id, name, position FROM vendor_categories ORDER BY position, id'
const VENDOR_COLUMNS = `id, category_id, name, href,
  CASE WHEN length(logo) > 0 THEN 1 ELSE 0 END AS has_logo,
  shown, position, version`

function num(value: unknown): number {
  const n = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(n) ? n : 0
}

function truthy(value: unknown): boolean {
  return value === true || value === 1 || value === '1' || value === 't' || value === 'true'
}

function deskVendor(row: VendorRow): DeskVendor {
  const id = num(row.id)
  return {
    id,
    categoryId: num(row.category_id),
    name: row.name,
    href: row.href,
    logo: truthy(row.has_logo) ? vendorLogoUrl(id, num(row.version)) : null,
    shown: truthy(row.shown),
  }
}

/** The public page: visible vendors, grouped, in Piper's order. One Book call. */
export async function listPublicVendors(): Promise<PublicVendorGroup[]> {
  await ensureVendors()
  const [categories = [], vendors = []] = (await queryBatch([
    { sql: CATEGORY_SQL },
    {
      sql: `SELECT ${VENDOR_COLUMNS} FROM vendors WHERE shown <> 0 ORDER BY position, id`,
    },
  ])) as [CategoryRow[], VendorRow[]]
  return publicVendorGroups(
    categories.map((row) => ({ id: num(row.id), name: row.name })),
    vendors.map(deskVendor),
  )
}

/** Every category and vendor, hidden ones included, for the desk. */
export async function listDeskVendors(): Promise<DeskVendorCategory[]> {
  await ensureVendors()
  const [categories = [], vendors = []] = (await queryBatch([
    { sql: CATEGORY_SQL },
    { sql: `SELECT ${VENDOR_COLUMNS} FROM vendors ORDER BY position, id` },
  ])) as [CategoryRow[], VendorRow[]]
  const all = vendors.map(deskVendor)
  return categories.map((row) => {
    const id = num(row.id)
    return {
      id,
      name: row.name,
      vendors: all.filter((vendor) => vendor.categoryId === id),
    }
  })
}

export async function vendorLogo(
  id: number,
): Promise<{ mime: string; logo: string; version: number } | null> {
  if (!Number.isInteger(id) || id < 1) return null
  await ensureVendors()
  const rows = await query<{ mime: string; logo: string; version: unknown }>(
    'SELECT mime, logo, version FROM vendors WHERE id = $1',
    [id],
  )
  const row = rows.at(0)
  if (!row || !row.logo || !/^image\/(png|jpeg|webp)$/.test(row.mime)) return null
  return { mime: row.mime, logo: row.logo, version: num(row.version) }
}

async function categoryExists(id: number): Promise<boolean> {
  if (!Number.isInteger(id) || id < 1) return false
  const rows = await query('SELECT id FROM vendor_categories WHERE id = $1', [id])
  return rows.length > 0
}

async function nextIds(categoryId: number): Promise<{ id: number; position: number }> {
  const [ids = [], positions = []] = (await queryBatch([
    { sql: 'SELECT COALESCE(MAX(id), 0) + 1 AS next FROM vendors' },
    {
      sql: 'SELECT COALESCE(MAX(position), -1) + 1 AS next FROM vendors WHERE category_id = $1',
      params: [categoryId],
    },
  ])) as [{ next: unknown }[], { next: unknown }[]]
  return { id: num(ids[0]?.next) || 1, position: num(positions[0]?.next) }
}

export async function addVendor(input: {
  name: string
  categoryId: number
  href: string
  logo?: string
  shown?: boolean
}): Promise<void> {
  await ensureVendors()
  const name = vendorName(input.name, 'The vendor name')
  const href = vendorWebsite(input.href)
  const logo = input.logo?.trim() ? vendorLogoData(input.logo) : { mime: '', logo: '' }
  if (!(await categoryExists(input.categoryId))) throw new Error('Choose a category.')
  const next = await nextIds(input.categoryId)
  await query(
    `INSERT INTO vendors (id, category_id, name, href, mime, logo, shown, position, version)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 1)`,
    [
      next.id,
      input.categoryId,
      name,
      href,
      logo.mime,
      logo.logo,
      input.shown === false ? 0 : 1,
      next.position,
    ],
  )
}

async function currentVendor(id: number): Promise<{ categoryId: number } | null> {
  if (!Number.isInteger(id) || id < 1) return null
  const rows = await query<{ category_id: unknown }>(
    'SELECT category_id FROM vendors WHERE id = $1',
    [id],
  )
  const row = rows.at(0)
  return row ? { categoryId: num(row.category_id) } : null
}

export async function updateVendor(input: {
  id: number
  name: string
  categoryId: number
  href: string
  /** A new logo, '' to keep the current one. */
  logo?: string
  removeLogo?: boolean
}): Promise<void> {
  await ensureVendors()
  const current = await currentVendor(input.id)
  if (!current) throw new Error('That vendor is no longer on the list.')
  const name = vendorName(input.name, 'The vendor name')
  const href = vendorWebsite(input.href)
  const logo = input.logo?.trim() ? vendorLogoData(input.logo) : null
  if (!(await categoryExists(input.categoryId))) throw new Error('Choose a category.')
  const statements: { sql: string; params?: unknown[] }[] = [
    {
      sql: 'UPDATE vendors SET name = $1, href = $2 WHERE id = $3',
      params: [name, href, input.id],
    },
  ]
  if (input.categoryId !== current.categoryId) {
    const next = await nextIds(input.categoryId)
    statements.push({
      sql: 'UPDATE vendors SET category_id = $1, position = $2 WHERE id = $3',
      params: [input.categoryId, next.position, input.id],
    })
  }
  if (logo) {
    statements.push({
      sql: 'UPDATE vendors SET mime = $1, logo = $2, version = version + 1 WHERE id = $3',
      params: [logo.mime, logo.logo, input.id],
    })
  } else if (input.removeLogo) {
    statements.push({
      sql: `UPDATE vendors SET mime = '', logo = '', version = version + 1 WHERE id = $1`,
      params: [input.id],
    })
  }
  await queryBatch(statements)
}

export async function setVendorShown(id: number, shown: boolean): Promise<void> {
  await ensureVendors()
  if (!(await currentVendor(id))) throw new Error('That vendor is no longer on the list.')
  await query('UPDATE vendors SET shown = $1 WHERE id = $2', [shown ? 1 : 0, id])
}

export async function removeVendor(id: number): Promise<void> {
  await ensureVendors()
  if (!Number.isInteger(id) || id < 1) throw new Error('That vendor is no longer on the list.')
  await query('DELETE FROM vendors WHERE id = $1', [id])
}

export async function moveVendor(id: number, direction: 'up' | 'down'): Promise<void> {
  await ensureVendors()
  const current = await currentVendor(id)
  if (!current) throw new Error('That vendor is no longer on the list.')
  const rows = await query<{ id: unknown }>(
    'SELECT id FROM vendors WHERE category_id = $1 ORDER BY position, id',
    [current.categoryId],
  )
  const ids = rows.map((row) => num(row.id))
  const order = moved(ids, ids.indexOf(id), direction)
  await queryBatch(
    order.map((vendorId, position) => ({
      sql: 'UPDATE vendors SET position = $1 WHERE id = $2',
      params: [position, vendorId],
    })),
  )
}

export async function addVendorCategory(nameInput: string): Promise<void> {
  await ensureVendors()
  const name = vendorName(nameInput, 'The category name')
  const [ids = [], same = []] = (await queryBatch([
    {
      sql: `SELECT COALESCE(MAX(id), 0) + 1 AS next, COALESCE(MAX(position), -1) + 1 AS position
            FROM vendor_categories`,
    },
    {
      sql: 'SELECT id FROM vendor_categories WHERE lower(name) = lower($1)',
      params: [name],
    },
  ])) as [{ next: unknown; position: unknown }[], unknown[]]
  if (same.length > 0) throw new Error('That category is already on the list.')
  await query('INSERT INTO vendor_categories (id, name, position) VALUES ($1, $2, $3)', [
    num(ids[0]?.next) || 1,
    name,
    num(ids[0]?.position),
  ])
}

export async function renameVendorCategory(id: number, nameInput: string): Promise<void> {
  await ensureVendors()
  const name = vendorName(nameInput, 'The category name')
  if (!(await categoryExists(id))) throw new Error('That category is no longer on the list.')
  const same = await query(
    'SELECT id FROM vendor_categories WHERE lower(name) = lower($1) AND id <> $2',
    [name, id],
  )
  if (same.length > 0) throw new Error('That category is already on the list.')
  await query('UPDATE vendor_categories SET name = $1 WHERE id = $2', [name, id])
}

export async function removeVendorCategory(id: number): Promise<void> {
  await ensureVendors()
  if (!(await categoryExists(id))) throw new Error('That category is no longer on the list.')
  const inside = await query('SELECT id FROM vendors WHERE category_id = $1', [id])
  if (inside.length > 0) {
    throw new Error(
      `Move or delete the ${inside.length === 1 ? 'vendor' : `${inside.length} vendors`} in this category first.`,
    )
  }
  await query('DELETE FROM vendor_categories WHERE id = $1', [id])
}

export async function moveVendorCategory(id: number, direction: 'up' | 'down'): Promise<void> {
  await ensureVendors()
  const rows = await query<{ id: unknown }>(
    'SELECT id FROM vendor_categories ORDER BY position, id',
  )
  const ids = rows.map((row) => num(row.id))
  if (!ids.includes(id)) throw new Error('That category is no longer on the list.')
  const order = moved(ids, ids.indexOf(id), direction)
  await queryBatch(
    order.map((categoryId, position) => ({
      sql: 'UPDATE vendor_categories SET position = $1 WHERE id = $2',
      params: [position, categoryId],
    })),
  )
}

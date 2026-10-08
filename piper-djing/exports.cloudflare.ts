import { DurableObject } from 'cloudflare:workers'
import { TERMS_BODY } from './src/lib/crm/terms.ts'

const EDGE_SCHEMA = [
  `CREATE TABLE IF NOT EXISTS sessions (
    id text PRIMARY KEY,
    created_at text NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS bookings (
    id integer PRIMARY KEY AUTOINCREMENT,
    slug text NOT NULL UNIQUE,
    partner_one text NOT NULL,
    partner_two text NOT NULL,
    email text NOT NULL DEFAULT '',
    phone text NOT NULL DEFAULT '',
    event_date text NOT NULL,
    stag_date text,
    package_id text NOT NULL,
    with_stag integer NOT NULL DEFAULT 0,
    uplights integer NOT NULL DEFAULT 0,
    venue_km text NOT NULL DEFAULT '[]',
    venue_name text NOT NULL DEFAULT '',
    venue_street text NOT NULL DEFAULT '',
    venue_two_name text NOT NULL DEFAULT '',
    venue_two_street text NOT NULL DEFAULT '',
    sample integer NOT NULL DEFAULT 0,
    status text NOT NULL,
    total_cents integer NOT NULL,
    deposit_cents integer NOT NULL,
    hold_started_on text,
    stag_released integer NOT NULL DEFAULT 0,
    notes text NOT NULL DEFAULT ''
  )`,
  `CREATE TABLE IF NOT EXISTS invoices (
    id integer PRIMARY KEY AUTOINCREMENT,
    slug text NOT NULL UNIQUE,
    booking_id integer NOT NULL UNIQUE REFERENCES bookings (id),
    status text NOT NULL,
    total_cents integer NOT NULL,
    deposit_cents integer NOT NULL,
    received_cents integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS payments (
    id integer PRIMARY KEY AUTOINCREMENT,
    invoice_id integer NOT NULL REFERENCES invoices (id),
    cents integer NOT NULL,
    note text NOT NULL DEFAULT '',
    created_at text NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS leads (
    id integer PRIMARY KEY AUTOINCREMENT,
    partner_one text NOT NULL,
    partner_two text NOT NULL,
    email text NOT NULL,
    phone text NOT NULL DEFAULT '',
    event_date text,
    package_id text NOT NULL,
    message text NOT NULL DEFAULT '',
    created_at text NOT NULL DEFAULT (datetime('now'))
  )`,
  `CREATE TABLE IF NOT EXISTS terms (
    id integer PRIMARY KEY CHECK (id = 1),
    body text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS site (
    id integer PRIMARY KEY CHECK (id = 1),
    kind_words integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS questions (
    id integer PRIMARY KEY AUTOINCREMENT,
    prompt text NOT NULL,
    sort integer NOT NULL DEFAULT 0
  )`,
  `CREATE TABLE IF NOT EXISTS media (
    id integer PRIMARY KEY AUTOINCREMENT,
    title text NOT NULL,
    url text NOT NULL
  )`,
  `CREATE TABLE IF NOT EXISTS bots (
    id integer PRIMARY KEY AUTOINCREMENT,
    name text NOT NULL,
    token text NOT NULL UNIQUE,
    role text NOT NULL CHECK (role IN ('reader', 'writer', 'ceo'))
  )`,
  `CREATE TABLE IF NOT EXISTS emails (
    id integer PRIMARY KEY AUTOINCREMENT,
    booking_id integer REFERENCES bookings (id),
    kind text NOT NULL CHECK (kind IN ('booking', 'invoice')),
    to_address text NOT NULL,
    subject text NOT NULL,
    body text NOT NULL,
    delivered integer NOT NULL,
    detail text NOT NULL DEFAULT '',
    created_at text NOT NULL DEFAULT (datetime('now'))
  )`,
]

export class Book extends DurableObject {
  private ready: Promise<void> | null = null

  async query(
    sql: string,
    params: unknown[] = [],
  ): Promise<Record<string, unknown>[]> {
    await this.ensure()
    return this.ctx.storage.sql.exec(sql, ...params).toArray()
  }

  private ensure(): Promise<void> {
    if (!this.ready) {
      this.ready = this.init().catch((error: unknown) => {
        this.ready = null
        throw error
      })
    }
    return this.ready
  }

  private async init(): Promise<void> {
    for (const statement of EDGE_SCHEMA) this.ctx.storage.sql.exec(statement)
    const existing = this.ctx.storage.sql.exec('SELECT id FROM terms').toArray()
    if (existing.length === 0) {
      this.ctx.storage.sql.exec(
        'INSERT INTO terms (id, body) VALUES (1, ?)',
        TERMS_BODY,
      )
    }
    const site = this.ctx.storage.sql.exec('SELECT id FROM site').toArray()
    if (site.length === 0) {
      this.ctx.storage.sql.exec(
        'INSERT INTO site (id, kind_words) VALUES (1, 0)',
      )
    }
  }
}

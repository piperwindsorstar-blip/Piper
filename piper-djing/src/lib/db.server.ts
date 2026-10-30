import { reviseTerms, TERMS_BODY } from './crm/terms.ts'

type Row = Record<string, unknown>

type Client = {
  query: (text: string, params?: unknown[]) => Promise<Row[]>
}

let opening: Promise<Client> | null = null

const SCHEMA = `
CREATE TABLE sessions (
  id text PRIMARY KEY,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE bookings (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  partner_one text NOT NULL,
  partner_two text NOT NULL,
  email text NOT NULL DEFAULT '',
  phone text NOT NULL DEFAULT '',
  event_date text NOT NULL,
  stag_date text,
  package_id text NOT NULL,
  with_stag boolean NOT NULL DEFAULT false,
  uplights integer NOT NULL DEFAULT 0,
  venue_km text NOT NULL DEFAULT '[]',
  venue_name text NOT NULL DEFAULT '',
  venue_street text NOT NULL DEFAULT '',
  venue_two_name text NOT NULL DEFAULT '',
  venue_two_street text NOT NULL DEFAULT '',
  sample boolean NOT NULL DEFAULT false,
  status text NOT NULL,
  total_cents integer NOT NULL,
  deposit_cents integer NOT NULL,
  discount_cents integer NOT NULL DEFAULT 0,
  custom_total_cents integer NOT NULL DEFAULT 0,
  locked_total boolean NOT NULL DEFAULT false,
  hold_started_on text,
  stag_released boolean NOT NULL DEFAULT false,
  notes text NOT NULL DEFAULT '',
  planning text NOT NULL DEFAULT '',
  portal_passcode text NOT NULL DEFAULT '',
  portal_share text NOT NULL DEFAULT '',
  portal_share_on integer NOT NULL DEFAULT 0
);
CREATE TABLE invoices (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  slug text NOT NULL UNIQUE,
  booking_id integer NOT NULL UNIQUE REFERENCES bookings (id),
  status text NOT NULL,
  total_cents integer NOT NULL,
  deposit_cents integer NOT NULL,
  received_cents integer NOT NULL DEFAULT 0
);
CREATE TABLE payments (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  invoice_id integer NOT NULL REFERENCES invoices (id),
  cents integer NOT NULL,
  note text NOT NULL DEFAULT '',
  paid_on text NOT NULL DEFAULT '',
  method text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE leads (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  partner_one text NOT NULL,
  partner_two text NOT NULL,
  email text NOT NULL,
  phone text NOT NULL DEFAULT '',
  event_date text,
  package_id text NOT NULL,
  with_stag integer NOT NULL DEFAULT 0,
  stag_date text,
  message text NOT NULL DEFAULT '',
  venue_name text NOT NULL DEFAULT '',
  venue_street text NOT NULL DEFAULT '',
  venue_two_name text NOT NULL DEFAULT '',
  venue_two_street text NOT NULL DEFAULT '',
  referral text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE terms (
  id integer PRIMARY KEY CHECK (id = 1),
  body text NOT NULL
);
CREATE TABLE site (
  id integer PRIMARY KEY CHECK (id = 1),
  kind_words integer NOT NULL DEFAULT 0,
  portal_master text
);
CREATE TABLE partners (
  id integer PRIMARY KEY,
  name text NOT NULL,
  href text NOT NULL,
  mime text NOT NULL,
  logo text NOT NULL
);
CREATE TABLE reviews (
  id integer PRIMARY KEY,
  quote text NOT NULL,
  names text NOT NULL DEFAULT '',
  when_label text NOT NULL DEFAULT '',
  event_type text NOT NULL DEFAULT '',
  town text NOT NULL DEFAULT '',
  reviewed_on text NOT NULL DEFAULT '',
  source text NOT NULL DEFAULT 'other',
  show_on_site integer NOT NULL DEFAULT 0
);
CREATE TABLE questions (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  prompt text NOT NULL,
  sort integer NOT NULL DEFAULT 0
);
CREATE TABLE media (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  title text NOT NULL,
  url text NOT NULL
);
CREATE TABLE bots (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  token text NOT NULL UNIQUE,
  role text NOT NULL CHECK (role IN ('reader', 'writer', 'ceo'))
);
CREATE TABLE emails (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  booking_id integer REFERENCES bookings (id),
  kind text NOT NULL CHECK (kind IN ('booking', 'invoice')),
  to_address text NOT NULL,
  subject text NOT NULL,
  body text NOT NULL,
  delivered boolean NOT NULL,
  detail text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE venues (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text NOT NULL,
  street text NOT NULL DEFAULT ''
);
CREATE UNIQUE INDEX venues_name_key ON venues (lower(name));
CREATE TABLE hidden_venues (
  name text PRIMARY KEY
);
CREATE TABLE external_dates (
  id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  event_date text NOT NULL,
  kind text NOT NULL,
  company text NOT NULL,
  label text NOT NULL DEFAULT '',
  partner_one text NOT NULL DEFAULT '',
  partner_two text NOT NULL DEFAULT '',
  venue_name text NOT NULL DEFAULT '',
  venue_street text NOT NULL DEFAULT '',
  venue_two_name text NOT NULL DEFAULT '',
  venue_two_street text NOT NULL DEFAULT '',
  notes text NOT NULL DEFAULT '',
  released integer NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS rsvp_weddings (
  slug text PRIMARY KEY,
  email text NOT NULL DEFAULT '',
  paid integer NOT NULL DEFAULT 0,
  sample integer NOT NULL DEFAULT 0,
  price_cents integer NOT NULL DEFAULT 3000,
  body text NOT NULL DEFAULT '{}'
);
CREATE INDEX IF NOT EXISTS rsvp_weddings_email ON rsvp_weddings (lower(email));
CREATE TABLE IF NOT EXISTS rsvp_emails (
  id text PRIMARY KEY,
  slug text NOT NULL,
  party_id text NOT NULL DEFAULT '',
  kind text NOT NULL,
  to_address text NOT NULL,
  subject text NOT NULL,
  delivered integer NOT NULL DEFAULT 0,
  detail text NOT NULL DEFAULT '',
  sent_at text NOT NULL
);
CREATE INDEX IF NOT EXISTS rsvp_emails_slug ON rsvp_emails (slug);
`

export type SqlStatement = { sql: string; params?: unknown[] }

type EdgeStub = {
  query: (sql: string, params?: unknown[]) => Promise<Row[]>
  batch?: (statements: { sql: string; params: unknown[] }[]) => Promise<Row[][]>
}

type EdgeBook = {
  idFromName: (name: string) => unknown
  get: (id: unknown) => EdgeStub
}

/** One increment is one Book durable-object call. A batch is one call. */
let bookCalls = 0

export function takeBookCalls(): number {
  const count = bookCalls
  bookCalls = 0
  return count
}

/** Tests can switch this on to see which statements a step sends. */
let bookLog: string[] | null = null

export function traceBookCalls(on: boolean): string[] {
  const seen = bookLog ?? []
  bookLog = on ? [] : null
  return seen
}

function noteBookCall(sql = ''): void {
  bookCalls += 1
  if (bookLog) bookLog.push(sql.replace(/\s+/g, ' ').trim().slice(0, 70))
}

function edgeBook(): EdgeBook | null {
  const env = (globalThis as { __env__?: { BOOK?: EdgeBook } }).__env__
  return env?.BOOK ?? null
}

export function usesEdgeBook(): boolean {
  return edgeBook() !== null
}

function positional(
  sql: string,
  params: unknown[],
): { sql: string; params: unknown[] } {
  if (!sql.includes('$')) return { sql, params }
  const ordered: unknown[] = []
  const next = sql.replace(/\$(\d+)/g, (_match, index: string) => {
    const value = params[Number(index) - 1]
    ordered.push(typeof value === 'boolean' ? (value ? 1 : 0) : value)
    return '?'
  })
  return { sql: next, params: ordered }
}

/**
 * Postgres when DATABASE_URL is set. Otherwise an empty in-memory database.
 * The published book is never created, seeded, or migrated from here.
 * Cloudflare keeps its own empty book and does not touch the published database.
 */
async function open(): Promise<Client> {
  const databaseUrl = process.env.DATABASE_URL
  if (databaseUrl) {
    const { Pool } = await import('pg')
    const pool = new Pool({ connectionString: databaseUrl })
    return {
      query: async (text, params = []) => {
        const result = await pool.query(text, params as never[])
        return result.rows as Row[]
      },
    }
  }

  const { PGlite } = await import('@electric-sql/pglite')
  const db = new PGlite()
  await db.exec(SCHEMA)
  const existing = await db.query<{ body: string }>(
    'SELECT body FROM terms WHERE id = 1',
  )
  const stored = existing.rows[0]?.body
  if (!stored) {
    await db.query('INSERT INTO terms (id, body) VALUES (1, $1)', [TERMS_BODY])
  } else {
    const next = reviseTerms(stored)
    if (next !== stored) {
      await db.query('UPDATE terms SET body = $1 WHERE id = 1', [next])
    }
  }
  const site = await db.query<{ id: number }>('SELECT id FROM site')
  if (site.rows.length === 0) {
    await db.query('INSERT INTO site (id, kind_words) VALUES (1, 0)')
  }
  return {
    query: async (text, params = []) => {
      const result = await db.query<Row>(text, params)
      return result.rows
    },
  }
}

export async function query<T extends Row>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const book = edgeBook()
  if (book) {
    const stub = book.get(book.idFromName('piper'))
    const statement = positional(text, params)
    noteBookCall(text)
    return (await stub.query(statement.sql, statement.params)) as T[]
  }
  if (!opening) opening = open()
  const client = await opening
  noteBookCall(text)
  return (await client.query(text, params)) as T[]
}

/** Several statements inside one Book call. Local tests count the batch as one call. */
export async function queryBatch<T extends Row = Row>(
  statements: SqlStatement[],
): Promise<T[][]> {
  if (statements.length === 0) return []
  const book = edgeBook()
  if (book) {
    const stub = book.get(book.idFromName('piper'))
    const prepared = statements.map((statement) =>
      positional(statement.sql, statement.params ?? []),
    )
    noteBookCall()
    if (stub.batch) return (await stub.batch(prepared)) as T[][]
    const rows: T[][] = []
    for (const statement of prepared) {
      rows.push((await stub.query(statement.sql, statement.params)) as T[])
    }
    return rows
  }
  if (!opening) opening = open()
  const client = await opening
  noteBookCall()
  const rows: T[][] = []
  for (const statement of statements) {
    rows.push(
      (await client.query(statement.sql, statement.params ?? [])) as T[],
    )
  }
  return rows
}

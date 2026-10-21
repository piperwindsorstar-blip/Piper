import type { Letter } from '../crm/mail-copy.ts'
import { emailLetter } from '../crm/mail.server.ts'
import type { MailResult } from '../crm/mail.server.ts'
import { query } from '../db.server.ts'
import type { RsvpEmailKind } from './emails.ts'
import { newToken } from './store.server.ts'

export type RsvpEmailRecord = {
  id: string
  slug: string
  partyId: string
  kind: RsvpEmailKind
  /** For a test send, which email was tested ("reminder", "invitation"…). */
  testOf: string
  to: string
  subject: string
  delivered: boolean
  detail: string
  sentAt: string
}

const TABLE = `
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
)`

/**
 * One row per email that is going out right now. A second send of the same
 * email to the same party inside the window is refused, so a double click, a
 * retry or two open tabs can never mail a guest twice.
 */
const GUARD = `
CREATE TABLE IF NOT EXISTS rsvp_send_guard (
  key text PRIMARY KEY,
  at bigint NOT NULL
)`

/** How long one email to one party blocks the same email again. */
export const SEND_GUARD_MS = 60_000

let ready: Promise<void> | null = null

function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(TABLE)
      await query(
        'CREATE INDEX IF NOT EXISTS rsvp_emails_slug ON rsvp_emails (slug)',
      )
      await query(GUARD)
    })().catch((error: unknown) => {
      ready = null
      throw error
    })
  }
  return ready
}

function flag(value: unknown): boolean {
  return (
    value === true ||
    value === 1 ||
    value === '1' ||
    value === 'true' ||
    value === 't'
  )
}

type Row = {
  id: string
  slug: string
  party_id: string
  kind: string
  to_address: string
  subject: string
  delivered: unknown
  detail: string
  sent_at: unknown
}

function record(row: Row): RsvpEmailRecord {
  const test = row.kind.startsWith('test')
  return {
    id: row.id,
    slug: row.slug,
    partyId: row.party_id,
    kind: (test ? 'test' : row.kind) as RsvpEmailKind,
    testOf: test ? row.kind.slice(5) : '',
    to: row.to_address,
    subject: row.subject,
    delivered: flag(row.delivered),
    detail: row.detail,
    sentAt:
      row.sent_at instanceof Date
        ? row.sent_at.toISOString()
        : String(row.sent_at ?? ''),
  }
}

/** The desk's record of every email sent for one RSVP. Newest first. */
export async function listRsvpEmails(slug: string): Promise<RsvpEmailRecord[]> {
  await ensure()
  const rows = await query<Row>(
    'SELECT * FROM rsvp_emails WHERE slug = $1 ORDER BY sent_at DESC, id DESC',
    [slug],
  )
  return rows.map(record)
}

async function remember(input: {
  slug: string
  partyId: string
  kind: string
  to: string
  subject: string
  result: MailResult
}): Promise<void> {
  await ensure()
  await query(
    `INSERT INTO rsvp_emails
       (id, slug, party_id, kind, to_address, subject, delivered, detail, sent_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
    [
      newToken(),
      input.slug,
      input.partyId,
      input.kind,
      input.to,
      input.subject,
      input.result.delivered ? 1 : 0,
      input.result.detail.slice(0, 500),
      new Date().toISOString(),
    ],
  )
}

/** The guard key for one email type to one party (or one test type). */
export function sendKey(slug: string, kind: string, target: string): string {
  return `${slug}|${kind}|${target}`.slice(0, 200)
}

/**
 * Takes the send slot for this key. False means the same email to the same
 * party started less than SEND_GUARD_MS ago. A guard that cannot be read never
 * blocks a send.
 */
export async function claimSend(key: string, now = Date.now()): Promise<boolean> {
  try {
    await ensure()
    const rows = await query<{ key: string }>(
      `INSERT INTO rsvp_send_guard (key, at) VALUES ($1, $2)
       ON CONFLICT (key) DO UPDATE SET at = EXCLUDED.at
       WHERE rsvp_send_guard.at < $3
       RETURNING key`,
      [key, now, now - SEND_GUARD_MS],
    )
    return rows.length > 0
  } catch {
    return true
  }
}

/** Frees the slot after a failed send, so the couple can retry at once. */
async function releaseSend(key: string): Promise<void> {
  try {
    await query('DELETE FROM rsvp_send_guard WHERE key = $1', [key])
  } catch {
    // The slot runs out on its own.
  }
}

export type RsvpSendResult = MailResult & { duplicate?: boolean }

export const DUPLICATE_DETAIL =
  'That email went out moments ago, so it was not sent twice.'

/**
 * Sends one RSVP email and writes it to the desk's log. The log write never
 * breaks the send: a missing table still returns the delivery result.
 *
 * With `guard`, the same email to the same party cannot go out twice inside
 * SEND_GUARD_MS. `testOf` records which email a test send was.
 */
export async function sendRsvpEmail(input: {
  slug: string
  kind: RsvpEmailKind
  to: string
  email: Letter
  partyId?: string
  guard?: string
  testOf?: string
}): Promise<RsvpSendResult> {
  if (input.guard && !(await claimSend(input.guard))) {
    return { delivered: false, duplicate: true, detail: DUPLICATE_DETAIL }
  }
  const result = await emailLetter(input.to, input.email)
  if (input.guard && !result.delivered) await releaseSend(input.guard)
  try {
    await remember({
      slug: input.slug,
      partyId: input.partyId ?? '',
      kind:
        input.kind === 'test' && input.testOf
          ? `test:${input.testOf}`.slice(0, 40)
          : input.kind,
      to: input.to,
      subject: input.email.subject,
      result,
    })
  } catch {
    return {
      delivered: result.delivered,
      detail: `${result.detail} The desk log was not written.`,
    }
  }
  return result
}

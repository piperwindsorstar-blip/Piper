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

let ready: Promise<void> | null = null

function ensure(): Promise<void> {
  if (!ready) {
    ready = (async () => {
      await query(TABLE)
      await query(
        'CREATE INDEX IF NOT EXISTS rsvp_emails_slug ON rsvp_emails (slug)',
      )
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
  return {
    id: row.id,
    slug: row.slug,
    partyId: row.party_id,
    kind: row.kind as RsvpEmailKind,
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
  kind: RsvpEmailKind
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

/**
 * Sends one RSVP email and writes it to the desk's log. The log write never
 * breaks the send: a missing table still returns the delivery result.
 */
export async function sendRsvpEmail(input: {
  slug: string
  kind: RsvpEmailKind
  to: string
  email: Letter
  partyId?: string
}): Promise<MailResult> {
  const result = await emailLetter(input.to, input.email)
  try {
    await remember({
      slug: input.slug,
      partyId: input.partyId ?? '',
      kind: input.kind,
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

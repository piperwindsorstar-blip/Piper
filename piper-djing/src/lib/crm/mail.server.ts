import nodemailer from 'nodemailer'
import { query, usesEdgeBook } from '../db.server.ts'
import { PUBLIC_EMAIL } from './defaults.ts'
import {
  bookingLetter,
  coupleAddress,
  invoiceLetter,
  type Letter,
  type LetterBooking,
} from './mail-copy.ts'
import { publicUrl } from './safe-origin.ts'
import { listBookings, type BookingView } from './store.server.ts'

export type MailResult = {
  delivered: boolean
  detail: string
}

export type SentMail = {
  id: number
  bookingId: number | null
  kind: 'booking' | 'invoice'
  to: string
  subject: string
  body: string
  delivered: boolean
  detail: string
  createdAt: string
}

type Smtp = {
  host: string
  port: number
  secure: boolean
  user: string
  pass: string
  from: string
  replyTo: string | null
}

const EMAILS_TABLE = `
CREATE TABLE IF NOT EXISTS emails (
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
`

export function mailStatus(): { ready: boolean; from: string } {
  const smtp = smtpConfig()
  return { ready: smtp !== null, from: smtp?.from ?? defaultFrom() }
}

export async function listEmails(): Promise<SentMail[]> {
  if (process.env.DATABASE_URL) return []
  await ensureLocalTable()
  const rows = await query<{
    id: number
    booking_id: number | null
    kind: string
    to_address: string
    subject: string
    body: string
    delivered: unknown
    detail: string
    created_at: unknown
  }>('SELECT * FROM emails ORDER BY id DESC LIMIT 50')
  return rows.map((row) => ({
    id: row.id,
    bookingId: row.booking_id,
    kind: row.kind === 'invoice' ? 'invoice' : 'booking',
    to: row.to_address,
    subject: row.subject,
    body: row.body,
    delivered:
      row.delivered === true ||
      row.delivered === 't' ||
      row.delivered === 'true' ||
      row.delivered === 1,
    detail: row.detail,
    createdAt:
      row.created_at instanceof Date
        ? row.created_at.toISOString()
        : String(row.created_at ?? ''),
  }))
}

export async function emailBooking(bookingId: number): Promise<MailResult> {
  const booking = await requireBooking(bookingId)
  const to = coupleAddress(booking.email)
  return deliverAndRemember(
    booking.id,
    'booking',
    to,
    bookingLetter(toLetter(booking), publicUrl),
  )
}

export async function emailInvoice(bookingId: number): Promise<MailResult> {
  const booking = await requireBooking(bookingId)
  const to = coupleAddress(booking.email)
  return deliverAndRemember(
    booking.id,
    'invoice',
    to,
    invoiceLetter(toLetter(booking), publicUrl),
  )
}

async function requireBooking(bookingId: number): Promise<BookingView> {
  const booking = (await listBookings()).find((item) => item.id === bookingId)
  if (!booking) throw new Error('That booking is not on the book.')
  return booking
}

function toLetter(booking: BookingView): LetterBooking {
  return {
    partnerOne: booking.partnerOne,
    partnerTwo: booking.partnerTwo,
    eventDate: booking.eventDate,
    stagDate: booking.stagDate,
    packageName: booking.packageName,
    withStag: booking.withStag,
    venueName: booking.venueName,
    venueStreet: booking.venueStreet,
    venueTwoName: booking.venueTwoName,
    venueTwoStreet: booking.venueTwoStreet,
    sample: booking.sample,
    status: booking.status,
    totalCents: booking.totalCents,
    depositCents: booking.depositCents,
    slug: booking.slug,
    holdStartedOn: booking.holdStartedOn,
    holdLastDay: booking.holdLastDay,
    stagReleased: booking.stagReleased,
    invoice: booking.invoice
      ? {
          slug: booking.invoice.slug,
          status: booking.invoice.status,
          totalCents: booking.invoice.totalCents,
          depositCents: booking.invoice.depositCents,
          receivedCents: booking.invoice.receivedCents,
          balanceCents: booking.invoice.balanceCents,
        }
      : null,
  }
}

async function deliverAndRemember(
  bookingId: number,
  kind: 'booking' | 'invoice',
  to: string,
  letter: Letter,
): Promise<MailResult> {
  const result = await deliver(to, letter)
  try {
    await remember(bookingId, kind, to, letter, result)
  } catch {
    return {
      delivered: result.delivered,
      detail: `${result.detail} The local copy was not saved.`,
    }
  }
  return result
}

async function deliver(to: string, letter: Letter): Promise<MailResult> {
  const smtp = smtpConfig()
  if (!smtp) {
    const saved = process.env.DATABASE_URL
      ? 'The message was not sent.'
      : 'The message is saved on the local book and was not sent.'
    return {
      delivered: false,
      detail: `The ${PUBLIC_EMAIL} inbox needs its Gmail app password before it can send. ${saved}`,
    }
  }
  try {
    const transport = nodemailer.createTransport({
      host: smtp.host,
      port: smtp.port,
      secure: smtp.secure,
      auth: { user: smtp.user, pass: smtp.pass },
    })
    await transport.sendMail({
      from: smtp.from,
      to,
      replyTo: smtp.replyTo ?? undefined,
      subject: letter.subject,
      text: letter.text,
      html: asHtml(letter.text),
    })
    return { delivered: true, detail: 'Sent.' }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'The mail server refused the message.'
    return { delivered: false, detail: message.slice(0, 500) }
  }
}

async function remember(
  bookingId: number,
  kind: 'booking' | 'invoice',
  to: string,
  letter: Letter,
  result: MailResult,
): Promise<void> {
  if (process.env.DATABASE_URL) return
  await ensureLocalTable()
  await query(
    `INSERT INTO emails (booking_id, kind, to_address, subject, body, delivered, detail)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [
      bookingId,
      kind,
      to,
      letter.subject,
      letter.text,
      result.delivered,
      result.detail.slice(0, 500),
    ],
  )
}

let tableReady: Promise<void> | null = null

function ensureLocalTable(): Promise<void> {
  if (process.env.DATABASE_URL || usesEdgeBook()) return Promise.resolve()
  if (!tableReady) {
    tableReady = query(EMAILS_TABLE).then(() => undefined)
  }
  return tableReady
}

function smtpConfig(): Smtp | null {
  const pass = process.env.PIPER_SMTP_PASS
  if (!pass) return null
  const host = process.env.PIPER_SMTP_HOST?.trim() || 'smtp.gmail.com'
  const user = process.env.PIPER_SMTP_USER?.trim() || PUBLIC_EMAIL
  const port = Number(process.env.PIPER_SMTP_PORT ?? 587)
  return {
    host,
    port,
    secure: process.env.PIPER_SMTP_SECURE
      ? process.env.PIPER_SMTP_SECURE === 'true'
      : port === 465,
    user,
    pass,
    from: fromAddress(),
    replyTo: process.env.PIPER_MAIL_REPLY_TO?.trim() || PUBLIC_EMAIL,
  }
}

function fromAddress(): string {
  return process.env.PIPER_MAIL_FROM?.trim() || defaultFrom()
}

function defaultFrom(): string {
  return `Piper DJing <${PUBLIC_EMAIL}>`
}

function asHtml(body: string): string {
  const escaped = body
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1">$1</a>')
  return `<div style="font-family:Georgia,serif;font-size:16px;line-height:1.6;color:#1a1816;white-space:pre-wrap">${escaped}</div>`
}

import { query } from '../db.server.ts'
import { emailOwner } from '../crm/mail.server.ts'
import { PUBLIC_EMAIL } from '../crm/defaults.ts'
import { publicUrl } from '../crm/safe-origin.ts'
import type { RsvpOutcome } from '../crm/stripe-webhook.ts'
import { piperPaymentEmail, welcomeEmail } from './emails.ts'
import { sendRsvpEmail } from './mailer.server.ts'
import { blankWedding, rsvpPath } from './model.ts'
import type { PriceKind, RsvpWedding } from './model.ts'
import { paidLabel, placePurchase } from './purchase.ts'
import type { PriceBooking, RsvpPurchase } from './purchase.ts'
import {
  listRsvps,
  newInviteCode,
  newToken,
  readRsvp,
  writeRsvp,
} from './store.server.ts'

const PURCHASES = `CREATE TABLE IF NOT EXISTS rsvp_purchases (
  session_id text PRIMARY KEY,
  slug text NOT NULL DEFAULT '',
  couple text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  price_kind text NOT NULL DEFAULT '',
  base_cents integer NOT NULL DEFAULT 0,
  hst_cents integer NOT NULL DEFAULT 0,
  payment_id text NOT NULL DEFAULT '',
  live integer NOT NULL DEFAULT 0,
  outcome text NOT NULL DEFAULT '',
  paid_on text NOT NULL DEFAULT '',
  opened integer NOT NULL DEFAULT 0,
  created_at text NOT NULL DEFAULT ''
)`

/** Every Piper booking as the RSVP price check needs it. */
export async function priceBookings(): Promise<PriceBooking[]> {
  const rows = await query<{
    email: string
    sample: unknown
    status: string
    invoice_slug: string | null
    deposit_cents: unknown
    received_cents: unknown
  }>(
    `SELECT bookings.email AS email, bookings.sample AS sample, bookings.status AS status,
            invoices.slug AS invoice_slug, invoices.deposit_cents AS deposit_cents,
            invoices.received_cents AS received_cents
     FROM bookings LEFT JOIN invoices ON invoices.booking_id = bookings.id`,
  )
  const flag = (value: unknown) =>
    value === true || value === 1 || value === '1' || value === 't' || value === 'true'
  return rows.map((row) => ({
    email: row.email ?? '',
    invoiceSlug: row.invoice_slug ?? '',
    sample: flag(row.sample),
    status: row.status ?? '',
    depositCents: Number(row.deposit_cents ?? 0) || 0,
    receivedCents: Number(row.received_cents ?? 0) || 0,
  }))
}

function signIn(wedding: RsvpWedding): string {
  const token = newToken()
  wedding.signInToken = token
  // One use; a week to open it from the welcome email.
  wedding.signInExpires = new Date(Date.now() + 7 * 86_400_000).toISOString()
  return publicUrl(`/rsvp/open/${token}`)
}

async function welcome(
  wedding: RsvpWedding,
  sessionId: string,
  amount: string,
  dashboardUrl: string,
) {
  await sendRsvpEmail({
    slug: wedding.slug,
    kind: 'welcome',
    to: wedding.email,
    guard: `rsvp-welcome-${sessionId}`,
    email: welcomeEmail(wedding, {
      amountLabel: amount,
      dashboardUrl,
      guestUrl: publicUrl(rsvpPath(wedding.slug)),
    }),
  })
}

/**
 * The webhook's RSVP step. Never makes a second site: the couple's email
 * already on a site pays that site; a site already holding these names under
 * another email is left alone and the owner is asked to check.
 */
export async function fulfilRsvpPurchase(input: {
  sessionId: string
  paymentId: string
  live: boolean
  purchase: RsvpPurchase
  priceKind: PriceKind
  baseCents: number
  hstCents: number
}): Promise<RsvpOutcome> {
  await query(PURCHASES)
  const { purchase } = input
  const amount = paidLabel(input)
  const couple = `${purchase.partnerOne} & ${purchase.partnerTwo}`
  const sites = await listRsvps()
  const place = placePurchase(sites, purchase)
  const slug = place.slug
  const byEmail =
    place.outcome === 'attached'
      ? (sites.find((item) => item.slug === slug) ?? null)
      : null
  const bySlug = place.outcome === 'needs-check' ? await readRsvp(slug) : null

  const free = input.baseCents + input.hstCents === 0
  let result: RsvpOutcome
  if (byEmail) {
    const wasPaid = byEmail.paid
    byEmail.paid = true
    const link = signIn(byEmail)
    await writeRsvp(byEmail)
    await welcome(byEmail, input.sessionId, amount, link)
    if (!free) await emailOwner({
      subject: 'RSVP purchase · please check',
      text: `${couple} (${purchase.email}) paid ${amount} for an RSVP page, and that email already has one: /rsvp/${byEmail.slug} (${wasPaid ? 'already paid before' : 'now marked paid'}). No new site was made. Check whether a refund is owed.`,
    }).catch(() => undefined)
    result = { slug: byEmail.slug, outcome: 'attached' }
  } else if (bySlug) {
    await sendRsvpEmail({
      slug: bySlug.slug,
      kind: 'welcome',
      to: purchase.email,
      guard: `rsvp-welcome-${input.sessionId}`,
      email: {
        subject: free ? `RSVP page · ${couple}` : `Payment received · ${couple}`,
        text: [
          free
            ? `Thank you, ${couple}. Your RSVP page comes free with your Piper booking.`
            : `Thank you, ${couple}. Your payment of ${amount} for an RSVP page is in.`,
          '',
          'Piper is setting up your page by hand and will email you the sign-in link shortly.',
          '',
          'Piper DJing',
        ].join('\n'),
      },
    })
    await emailOwner({
      subject: 'RSVP purchase · please check',
      text: `${couple} (${purchase.email}) ${free ? 'asked for their free' : `paid ${amount} for an`} RSVP page, but /rsvp/${bySlug.slug} already belongs to ${bySlug.email || 'another email'}. No site was opened for them. If it is the same couple, change that site's email and send them a sign-in link; if not, make them a site by hand from the desk.`,
    }).catch(() => undefined)
    result = { slug: bySlug.slug, outcome: 'needs-check' }
  } else {
    const wedding = blankWedding({
      slug,
      partnerOne: purchase.partnerOne,
      partnerTwo: purchase.partnerTwo,
      email: purchase.email,
      eventDate: purchase.eventDate,
      venue: '',
      priceCents: input.baseCents,
      priceKind: input.priceKind,
      inviteCode: newInviteCode(),
    })
    wedding.slug = slug
    wedding.replyEmail = purchase.email
    wedding.paid = true
    const link = signIn(wedding)
    await writeRsvp(wedding)
    await welcome(wedding, input.sessionId, amount, link)
    await sendRsvpEmail({
      slug: wedding.slug,
      kind: 'piper-payment',
      to: PUBLIC_EMAIL,
      email: piperPaymentEmail(wedding, free ? amount : `${amount} (card, Stripe)`),
    }).catch(() => undefined)
    result = { slug, outcome: 'created' }
  }

  await query(
    `INSERT INTO rsvp_purchases
       (session_id, slug, couple, email, price_kind, base_cents, hst_cents, payment_id, live, outcome, paid_on, created_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
     ON CONFLICT (session_id) DO NOTHING`,
    [
      input.sessionId,
      result.slug,
      couple,
      purchase.email,
      input.priceKind,
      input.baseCents,
      input.hstCents,
      input.paymentId,
      input.live ? 1 : 0,
      result.outcome,
      new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Toronto' }).format(new Date()),
      new Date().toISOString(),
    ],
  )
  return result
}

export type RsvpPurchaseView = {
  sessionId: string
  slug: string
  couple: string
  email: string
  priceKind: string
  baseCents: number
  hstCents: number
  paymentId: string
  live: boolean
  outcome: string
  paidOn: string
}

export async function listRsvpPurchases(): Promise<RsvpPurchaseView[]> {
  await query(PURCHASES)
  const rows = await query<Record<string, unknown>>(
    'SELECT * FROM rsvp_purchases ORDER BY created_at DESC',
  )
  return rows.map((row) => ({
    sessionId: String(row.session_id ?? ''),
    slug: String(row.slug ?? ''),
    couple: String(row.couple ?? ''),
    email: String(row.email ?? ''),
    priceKind: String(row.price_kind ?? ''),
    baseCents: Number(row.base_cents ?? 0) || 0,
    hstCents: Number(row.hst_cents ?? 0) || 0,
    paymentId: String(row.payment_id ?? ''),
    live: Number(row.live ?? 0) === 1 || row.live === true,
    outcome: String(row.outcome ?? ''),
    paidOn: String(row.paid_on ?? ''),
  }))
}

/**
 * Back from Stripe: signs the couple straight into their new dashboard,
 * once, within a day, and only for a site made or paid for that email.
 */
export async function openPurchasedSite(sessionId: string): Promise<
  { state: 'ready'; slug: string } | { state: 'waiting' } | { state: 'email' }
> {
  if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return { state: 'email' }
  await query(PURCHASES)
  const rows = await query<{
    slug: string
    outcome: string
    opened: unknown
    created_at: string
  }>(
    'SELECT slug, outcome, opened, created_at FROM rsvp_purchases WHERE session_id = $1',
    [sessionId],
  )
  const row = rows.at(0)
  if (!row) return { state: 'waiting' }
  const fresh = Date.now() - Date.parse(row.created_at) < 86_400_000
  const opened = Number(row.opened ?? 0) === 1 || row.opened === true
  if (row.outcome === 'needs-check' || opened || !fresh) return { state: 'email' }
  await query('UPDATE rsvp_purchases SET opened = 1 WHERE session_id = $1', [
    sessionId,
  ])
  return { state: 'ready', slug: row.slug }
}


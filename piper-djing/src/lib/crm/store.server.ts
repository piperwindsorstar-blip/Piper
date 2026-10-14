import { isReviewDisplay } from './google-reviews.ts'
import type { ReviewDisplay, ReviewPage } from './google-reviews.ts'
import { randomBytes } from 'node:crypto'
import { query, queryBatch, usesEdgeBook } from '../db.server.ts'
import {
  assertBookableDate,
  assertBookableNames,
  cancelBooking,
  countedCents,
  dateIsTaken,
  figuresFor,
  invoiceBalance,
  markInvoiceSent,
  matchCustom,
  recordMoney,
  releaseBooking,
  SAVED_WEDDINGS,
  savedWeddingNote,
  voidInvoice,
} from './booking-rules.ts'
import type { BookingState, InvoiceState } from './booking-rules.ts'
import { longDate } from './dates.ts'
import { isPackageId, PACKAGE_BUTTON_COPY, packageName } from './defaults.ts'
import { asExternalKind } from './external-dates.ts'
import type { ExternalDate } from './external-dates.ts'
import type { SavedVenue } from './venues.ts'
import type { PackageId } from './defaults.ts'
import { DESK_OWNER_EMAIL } from './desk-owner.ts'
import { HOME_BASE } from './home-base.ts'
import type { PackageOffer } from './packages.ts'
import {
  isPlanLocked,
  mergeCoupleSave,
  parsePlanning,
  planningFromUnknown,
} from './planning.ts'
import type { Planning, PlanningSeed } from './planning.ts'
import { isReviewSource } from './reviews.ts'
import type {
  PublicReview,
  ReviewDraft,
  ReviewSource,
  ReviewView,
} from './reviews.ts'
import { masterDrafts, parseMaster } from '../portal/master.ts'
import { rankSuggestions, songsFromPlans } from '../portal/song-suggestions.ts'
import type { SongHit } from '../portal/song-search.ts'
import type { MasterMap } from '../portal/questions.ts'
import { overallProgress } from '../portal/progress.ts'
import { forgetPublicSite } from './public-memory.ts'
import {
  holdLastDay,
  isBlockedDate,
  PACKAGE_CENTS,
  torontoToday,
} from '../piper/rules.ts'

export type { ReviewView }

export type BotRole = 'reader' | 'writer' | 'ceo'

export type InvoiceView = {
  id: number
  slug: string
  status: InvoiceState['status']
  totalCents: number
  depositCents: number
  receivedCents: number
  balanceCents: number
}

export type BookingView = {
  id: number
  slug: string
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string
  stagDate: string | null
  packageId: PackageId
  packageName: string
  withStag: boolean
  uplights: number
  venueKm: number[]
  venueName: string
  venueStreet: string
  venueTwoName: string
  venueTwoStreet: string
  sample: boolean
  status: BookingState['status']
  totalCents: number
  depositCents: number
  discountCents: number
  customTotalCents: number
  lockedTotal: boolean
  holdStartedOn: string | null
  holdLastDay: string | null
  stagReleased: boolean
  notes: string
  invoice: InvoiceView | null
}

export type LeadView = {
  id: number
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string | null
  packageId: string
  packageName: string
  withStag: boolean
  stagDate: string | null
  message: string
}

export type PaymentView = {
  id: number
  invoiceId: number
  bookingId: number
  names: string
  cents: number
  note: string
  paidOn: string
  method: string
  /** Card HST collected on top of this payment; never booking money. */
  hstCents: number
}

type BookingRow = {
  id: number
  slug: string
  partner_one: string
  partner_two: string
  email: string
  phone: string
  event_date: string
  stag_date: string | null
  package_id: string
  with_stag: unknown
  uplights: unknown
  venue_km: unknown
  venue_name: string
  venue_street: string
  venue_two_name: string
  venue_two_street: string
  sample: unknown
  status: string
  total_cents: unknown
  deposit_cents: unknown
  discount_cents?: unknown
  custom_total_cents?: unknown
  locked_total?: unknown
  hold_started_on: string | null
  stag_released: unknown
  notes: string
}

type InvoiceRow = {
  id: number
  slug: string
  booking_id: number
  status: string
  total_cents: unknown
  deposit_cents: unknown
  received_cents: unknown
}

const STATUSES = new Set(['open', 'hold', 'booked', 'cancelled', 'released'])
const INVOICE_STATUSES = new Set(['draft', 'sent', 'void'])

function text(value: string, max: number, label: string): string {
  const trimmed = value.trim().slice(0, max)
  if (!trimmed) throw new Error(`${label} is required.`)
  return trimmed
}

function optional(value: string, max: number): string {
  return value.trim().slice(0, max)
}

function flag(value: unknown): boolean {
  return value === true || value === 't' || value === 'true' || value === 1
}

function whole(value: unknown, label: string): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isInteger(number)) throw new Error(`${label} is a whole number.`)
  return number
}

function asPackage(value: string): PackageId {
  if (!isPackageId(value)) throw new Error('Choose a package.')
  return value
}

function leadPackage(value: string): string {
  const label = value.trim()
  if (isPackageId(label)) return label
  if (!label || label.length > 80) throw new Error('Choose a package.')
  return label
}

function asStatus(value: string): BookingState['status'] {
  if (!STATUSES.has(value)) throw new Error('That status is not on the book.')
  return value as BookingState['status']
}

function asInvoiceStatus(value: string): InvoiceState['status'] {
  if (!INVOICE_STATUSES.has(value))
    throw new Error('That invoice status is not on the book.')
  return value as InvoiceState['status']
}

export function parseKm(value: unknown): number[] {
  const parsed =
    typeof value === 'string' ? (JSON.parse(value) as unknown) : value
  if (!Array.isArray(parsed)) throw new Error('Travel is a list of kilometres.')
  if (parsed.length > 2) throw new Error('Two venues maximum.')
  return parsed.map((item) => {
    const km = typeof item === 'number' ? item : Number(item)
    if (!Number.isFinite(km) || km < 0)
      throw new Error('Distance is a number of kilometres.')
    return km
  })
}

function slug(): string {
  return randomBytes(9).toString('base64url')
}

function toState(row: BookingRow): BookingState {
  return {
    partnerOne: row.partner_one,
    partnerTwo: row.partner_two,
    eventDate: row.event_date,
    stagDate: row.stag_date,
    packageId: asPackage(row.package_id),
    withStag: flag(row.with_stag),
    uplights: whole(row.uplights, 'Uplight count'),
    venueKm: parseKm(row.venue_km),
    venueName: row.venue_name,
    venueStreet: row.venue_street,
    sample: flag(row.sample),
    status: asStatus(row.status),
    totalCents: whole(row.total_cents, 'Total'),
    depositCents: whole(row.deposit_cents, 'Deposit'),
    discountCents: whole(row.discount_cents ?? 0, 'Discount'),
    customTotalCents: whole(row.custom_total_cents ?? 0, 'Custom price'),
    lockedTotal: flag(row.locked_total),
    holdStartedOn: row.hold_started_on,
    stagReleased: flag(row.stag_released),
  }
}

function toInvoice(row: InvoiceRow): InvoiceState {
  return {
    status: asInvoiceStatus(row.status),
    totalCents: whole(row.total_cents, 'Total'),
    depositCents: whole(row.deposit_cents, 'Deposit'),
    receivedCents: whole(row.received_cents, 'Received'),
  }
}

function toInvoiceView(row: InvoiceRow): InvoiceView {
  const invoice = toInvoice(row)
  return {
    id: row.id,
    slug: row.slug,
    status: invoice.status,
    totalCents: invoice.totalCents,
    depositCents: invoice.depositCents,
    receivedCents: invoice.receivedCents,
    balanceCents: invoiceBalance(invoice),
  }
}

function toView(row: BookingRow, invoice: InvoiceRow | null): BookingView {
  const state = toState(row)
  return {
    id: row.id,
    slug: row.slug,
    partnerOne: state.partnerOne,
    partnerTwo: state.partnerTwo,
    email: row.email,
    phone: row.phone,
    eventDate: state.eventDate,
    stagDate: state.stagDate,
    packageId: state.packageId,
    packageName: packageName(state.packageId),
    withStag: state.withStag,
    uplights: state.uplights,
    venueKm: state.venueKm,
    venueName: state.venueName,
    venueStreet: state.venueStreet,
    venueTwoName: row.venue_two_name,
    venueTwoStreet: row.venue_two_street,
    sample: state.sample,
    status: state.status,
    totalCents: state.totalCents,
    depositCents: state.depositCents,
    discountCents: state.discountCents,
    customTotalCents: state.customTotalCents ?? 0,
    lockedTotal: state.lockedTotal ?? false,
    holdStartedOn: state.holdStartedOn,
    holdLastDay: state.holdStartedOn ? holdLastDay(state.holdStartedOn) : null,
    stagReleased: state.stagReleased,
    notes: row.notes,
    invoice: invoice ? toInvoiceView(invoice) : null,
  }
}

async function ensurePlanningColumn(): Promise<void> {
  try {
    await query('SELECT planning FROM bookings LIMIT 0')
  } catch {
    await query(
      `ALTER TABLE bookings ADD COLUMN planning text NOT NULL DEFAULT ''`,
    )
  }
}

async function ensureDiscountColumn(): Promise<void> {
  try {
    await query('SELECT discount_cents FROM bookings LIMIT 0')
  } catch {
    try {
      await query(
        'ALTER TABLE bookings ADD COLUMN discount_cents integer NOT NULL DEFAULT 0',
      )
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error)
      if (!/duplicate column|already exists/i.test(message)) throw error
    }
  }
}

async function ensureCustomColumns(): Promise<void> {
  for (const [name, definition] of [
    ['custom_total_cents', 'integer NOT NULL DEFAULT 0'],
    ['locked_total', 'boolean NOT NULL DEFAULT false'],
  ] as const) {
    try {
      await query(`SELECT ${name} FROM bookings LIMIT 0`)
    } catch {
      try {
        await query(`ALTER TABLE bookings ADD COLUMN ${name} ${definition}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!/duplicate column|already exists/i.test(message)) throw error
      }
    }
  }
}

async function ensurePaymentColumns(): Promise<void> {
  for (const [name, definition] of [
    ['paid_on', "text NOT NULL DEFAULT ''"],
    ['method', "text NOT NULL DEFAULT ''"],
    ['hst_cents', 'integer NOT NULL DEFAULT 0'],
  ] as const) {
    try {
      await query(`SELECT ${name} FROM payments LIMIT 0`)
    } catch {
      try {
        await query(`ALTER TABLE payments ADD COLUMN ${name} ${definition}`)
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error)
        if (!/duplicate column|already exists/i.test(message)) throw error
      }
    }
  }
}

async function bookingRows(): Promise<BookingRow[]> {
  await ensurePlanningColumn()
  await ensureDiscountColumn()
  await ensureCustomColumns()
  return query<BookingRow>('SELECT * FROM bookings ORDER BY id DESC')
}

async function invoiceFor(bookingId: number): Promise<InvoiceRow | null> {
  const rows = await query<InvoiceRow>(
    'SELECT * FROM invoices WHERE booking_id = $1',
    [bookingId],
  )
  return rows.at(0) ?? null
}

async function bookingRow(id: number): Promise<BookingRow> {
  await ensureDiscountColumn()
  await ensureCustomColumns()
  const rows = await query<BookingRow>('SELECT * FROM bookings WHERE id = $1', [
    id,
  ])
  const row = rows.at(0)
  if (!row) throw new Error('That booking is not on the book.')
  return row
}

async function states(): Promise<BookingState[]> {
  const rows = await bookingRows()
  return rows.map(toState)
}

const DISMISSED_TABLE = `CREATE TABLE IF NOT EXISTS dismissed_weddings (
  event_date text NOT NULL,
  partner_one text NOT NULL,
  partner_two text NOT NULL,
  PRIMARY KEY (event_date, partner_one, partner_two)
)`

async function dateTakenByOthers(
  day: string,
  exceptId: number | null,
): Promise<boolean> {
  const results = await queryBatch([
    { sql: DISMISSED_TABLE },
    {
      sql: `SELECT partner_one, partner_two FROM dismissed_weddings
            WHERE event_date = $1`,
      params: [day],
    },
    {
      sql: 'SELECT id FROM external_dates WHERE event_date = $1 AND released = 0',
      params: [day],
    },
    {
      sql: 'SELECT * FROM bookings WHERE event_date = $1 OR stag_date = $1',
      params: [day],
    },
  ])
  const dismissed = results[1] as { partner_one: string; partner_two: string }[]
  const externals = results[2] as { id: number }[]
  const bookings = results[3] as BookingRow[]
  if (externals.length > 0) return true
  const saved = SAVED_WEDDINGS.find((wedding) => wedding.date === day)
  if (saved) {
    const [one, two] = savedNames(saved.partnerOne, saved.partnerTwo)
    const gone = dismissed.some(
      (row) => row.partner_one === one && row.partner_two === two,
    )
    const ownRow =
      exceptId != null &&
      bookings.some(
        (row) =>
          row.id === exceptId &&
          savedNames(row.partner_one, row.partner_two)[0] === one &&
          savedNames(row.partner_one, row.partner_two)[1] === two,
      )
    if (!gone && !ownRow) return true
  }
  const others = bookings.filter((row) => row.id !== exceptId).map(toState)
  return dateIsTaken(others, day)
}

async function guardIdentity(
  partnerOne: string,
  partnerTwo: string,
  eventDate: string,
  stagDate: string | null,
) {
  assertBookableNames(partnerOne, partnerTwo)
  assertBookableDate(eventDate, stagDate)
  const saved = savedWeddingFor(partnerOne, partnerTwo, eventDate)
  if (!saved) return
  if (await isSavedWeddingDismissed(saved)) return
  throw new Error('That wedding is already on the book.')
}

export type BookingInput = {
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string
  stagDate: string | null
  packageId: string
  withStag: boolean
  uplights: number
  venueKm: number[]
  venueName: string
  venueStreet: string
  venueTwoName: string
  venueTwoStreet: string
  sample: boolean
  notes: string
  discountCents?: number
  customTotalCents?: number
  customDepositCents?: number
  lockedTotal?: boolean
}

function discountAmount(value: number | undefined): number {
  const amount = value ?? 0
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('The discount is a whole amount.')
  }
  return amount
}

function wholeOrZero(value: number | undefined): number {
  const amount = value ?? 0
  if (!Number.isInteger(amount) || amount < 0) {
    throw new Error('Money is whole cents.')
  }
  return amount
}

function normalize(input: BookingInput) {
  const partnerOne = text(input.partnerOne, 80, 'The first name')
  const partnerTwo = text(input.partnerTwo, 80, 'The second name')
  const packageId = asPackage(input.packageId)
  const withStag = packageId === 'full' && input.withStag
  if (input.withStag && packageId !== 'full') {
    throw new Error('A stag is added to the full wedding day.')
  }
  const stagDate = withStag && input.stagDate ? input.stagDate : null
  if (withStag && !stagDate) throw new Error('A stag needs its own date.')
  const eventDate = input.eventDate
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate))
    throw new Error('Choose a wedding date.')
  if (stagDate && !/^\d{4}-\d{2}-\d{2}$/.test(stagDate))
    throw new Error('Choose a stag date.')
  const venueKm = parseKm(input.venueKm)
  const uplights = input.uplights
  if (!Number.isInteger(uplights) || uplights < 0)
    throw new Error('Uplight count is a whole number.')
  return {
    partnerOne,
    partnerTwo,
    email: optional(input.email, 120),
    phone: optional(input.phone, 40),
    eventDate,
    stagDate,
    packageId,
    withStag,
    uplights,
    venueKm,
    venueName: optional(input.venueName, 160),
    venueStreet: optional(input.venueStreet, 160),
    venueTwoName: optional(input.venueTwoName, 160),
    venueTwoStreet: optional(input.venueTwoStreet, 160),
    sample: input.sample,
    notes: optional(input.notes, 2000),
    discountCents: discountAmount(input.discountCents),
    customTotalCents: wholeOrZero(input.customTotalCents),
    customDepositCents: wholeOrZero(input.customDepositCents),
    lockedTotal: input.lockedTotal ?? false,
  }
}

async function saveBooking(
  id: number,
  state: BookingState,
  invoice: InvoiceState | null,
) {
  await query(
    `UPDATE bookings SET
      status = $1, total_cents = $2, deposit_cents = $3, hold_started_on = $4, stag_released = $5
     WHERE id = $6`,
    [
      state.status,
      state.totalCents,
      state.depositCents,
      state.holdStartedOn,
      state.stagReleased,
      id,
    ],
  )
  if (!invoice) return
  await query(
    `UPDATE invoices SET status = $1, total_cents = $2, deposit_cents = $3, received_cents = $4
     WHERE booking_id = $5`,
    [
      invoice.status,
      invoice.totalCents,
      invoice.depositCents,
      invoice.receivedCents,
      id,
    ],
  )
}

async function ensureDateFree(
  eventDate: string,
  stagDate: string | null,
  stagReleased: boolean,
  exceptId: number | null,
) {
  if (await dateTakenByOthers(eventDate, exceptId))
    throw new Error('That wedding date is already held.')
  if (
    stagDate &&
    !stagReleased &&
    (await dateTakenByOthers(stagDate, exceptId))
  ) {
    throw new Error('That stag date is already held.')
  }
}

const SAVED_DEPOSIT_NOTE = 'Deposit cleared on the previous book.'

async function savedWeddingId(
  wedding: (typeof SAVED_WEDDINGS)[number],
): Promise<number | null> {
  const rows = await query<{ id: number }>(
    `SELECT id FROM bookings
     WHERE event_date = $1
       AND (
         (lower(partner_one) = lower($2) AND lower(partner_two) = lower($3))
         OR (lower(partner_one) = lower($3) AND lower(partner_two) = lower($2))
       )`,
    [wedding.date, wedding.partnerOne, wedding.partnerTwo],
  )
  const id = rows.at(0)?.id
  return id == null ? null : whole(id, 'Booking')
}

async function ensureSavedInvoice(
  bookingId: number,
  wedding: (typeof SAVED_WEDDINGS)[number],
): Promise<void> {
  const existing = await query<{ id: number }>(
    'SELECT id FROM invoices WHERE booking_id = $1',
    [bookingId],
  )
  let invoiceId = existing.at(0)?.id
  if (invoiceId == null) {
    const inserted = await query<{ id: number }>(
      `INSERT INTO invoices (slug, booking_id, status, total_cents, deposit_cents, received_cents)
       SELECT $1, $2, 'sent', $3, $4, $5
       WHERE NOT EXISTS (SELECT 1 FROM invoices WHERE booking_id = $2)
       RETURNING id`,
      [
        slug(),
        bookingId,
        wedding.totalCents,
        wedding.depositClearedCents,
        wedding.depositClearedCents,
      ],
    )
    invoiceId = inserted.at(0)?.id
    if (invoiceId == null) {
      const again = await query<{ id: number }>(
        'SELECT id FROM invoices WHERE booking_id = $1',
        [bookingId],
      )
      invoiceId = again.at(0)?.id
    }
  }
  if (invoiceId == null) return
  await query(
    `INSERT INTO payments (invoice_id, cents, note)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (
       SELECT 1 FROM payments WHERE invoice_id = $1 AND note = $3
     )`,
    [invoiceId, wedding.depositClearedCents, SAVED_DEPOSIT_NOTE],
  )
}

/** Copies the four booked weddings onto this book once. A deleted one stays deleted. */
export async function ensureSavedWeddings(): Promise<void> {
  for (const wedding of SAVED_WEDDINGS) {
    if (await isSavedWeddingDismissed(wedding)) continue
    let id = await savedWeddingId(wedding)
    if (id == null) {
      await ensureCustomColumns()
      const inserted = await query<{ id: number }>(
        `INSERT INTO bookings (
          slug, partner_one, partner_two, email, phone, event_date, stag_date, package_id, with_stag,
          uplights, venue_km, venue_name, venue_street, venue_two_name, venue_two_street, sample,
          status, total_cents, deposit_cents, hold_started_on, stag_released, notes,
          custom_total_cents, locked_total
        )
        SELECT $1, $2, $3, '', '', $4, NULL, 'custom', $9,
          0, '[]', $5, '', '', '', $10,
          'booked', $6, $7, NULL, $11, $8,
          $6, true
        WHERE NOT EXISTS (
          SELECT 1 FROM bookings
          WHERE event_date = $4
            AND (
              (lower(partner_one) = lower($2) AND lower(partner_two) = lower($3))
              OR (lower(partner_one) = lower($3) AND lower(partner_two) = lower($2))
            )
        )
        RETURNING id`,
        [
          slug(),
          wedding.partnerOne,
          wedding.partnerTwo,
          wedding.date,
          wedding.venueName,
          wedding.totalCents,
          wedding.depositClearedCents,
          savedWeddingNote(wedding),
          false,
          false,
          false,
        ],
      )
      id = inserted.at(0)?.id ?? (await savedWeddingId(wedding))
    }
    if (id == null) continue
    // Bookings 1-4 are Custom and locked: their agreed totals, deposits,
    // payments, and status never move.
    await ensureCustomColumns()
    await query(
      `UPDATE bookings
       SET package_id = 'custom', custom_total_cents = $1, locked_total = true
       WHERE id = $2 AND total_cents = $1`,
      [wedding.totalCents, id],
    )
    await ensureSavedInvoice(id, wedding)
  }
}

export async function listBookings(): Promise<BookingView[]> {
  await ensureSavedWeddings()
  const rows = await bookingRows()
  const invoices = await query<InvoiceRow>('SELECT * FROM invoices')
  const byBooking = new Map(invoices.map((row) => [row.booking_id, row]))
  const offers = await listPackageOffers()
  return rows.map((row) =>
    namedView(toView(row, byBooking.get(row.id) ?? null), offers),
  )
}

async function ensureVenues(): Promise<void> {
  const definition = usesEdgeBook()
    ? `id integer PRIMARY KEY AUTOINCREMENT,
      name text NOT NULL,
      street text NOT NULL DEFAULT ''`
    : `id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      name text NOT NULL,
      street text NOT NULL DEFAULT ''`
  await query(`CREATE TABLE IF NOT EXISTS venues (${definition})`)
  await query(
    'CREATE UNIQUE INDEX IF NOT EXISTS venues_name_key ON venues (lower(name))',
  )
  await query(
    `CREATE TABLE IF NOT EXISTS hidden_venues (
      name text PRIMARY KEY
    )`,
  )
}

async function venueRow(name: string): Promise<SavedVenue | null> {
  await ensureVenues()
  const rows = await query<{ id: number; name: string; street: string }>(
    'SELECT id, name, street FROM venues WHERE lower(name) = lower($1)',
    [name.trim()],
  )
  const row = rows.at(0)
  if (!row) return null
  return { id: whole(row.id, 'Venue'), name: row.name, street: row.street }
}

async function venueHidden(name: string): Promise<boolean> {
  await ensureVenues()
  const rows = await query<{ name: string }>(
    'SELECT name FROM hidden_venues WHERE name = $1',
    [name.trim().toLowerCase()],
  )
  return rows.length > 0
}

async function showVenue(name: string): Promise<void> {
  await ensureVenues()
  await query('DELETE FROM hidden_venues WHERE name = $1', [
    name.trim().toLowerCase(),
  ])
}

async function seedVenue(name: string, street: string): Promise<void> {
  const cleanName = optional(name, 160)
  if (!cleanName || (await venueHidden(cleanName))) return
  const cleanStreet = optional(street, 160)
  const existing = await venueRow(cleanName)
  if (!existing) {
    await query('INSERT INTO venues (name, street) VALUES ($1, $2)', [
      cleanName,
      cleanStreet,
    ])
    return
  }
  if (!existing.street && cleanStreet) {
    await query('UPDATE venues SET street = $1 WHERE id = $2', [
      cleanStreet,
      existing.id,
    ])
  }
}

async function rememberVenue(name: string, street: string): Promise<void> {
  const cleanName = optional(name, 160)
  if (!cleanName) return
  const cleanStreet = optional(street, 160)
  await showVenue(cleanName)
  const existing = await venueRow(cleanName)
  if (!existing) {
    await query('INSERT INTO venues (name, street) VALUES ($1, $2)', [
      cleanName,
      cleanStreet,
    ])
    return
  }
  if (!cleanStreet || existing.street === cleanStreet) return
  await query('UPDATE venues SET name = $1, street = $2 WHERE id = $3', [
    cleanName,
    cleanStreet,
    existing.id,
  ])
}

async function seedKnownVenues(): Promise<void> {
  await ensureVenues()
  const bookings = await query<{
    venue_name: string
    venue_street: string
    venue_two_name: string
    venue_two_street: string
  }>(
    'SELECT venue_name, venue_street, venue_two_name, venue_two_street FROM bookings',
  )
  for (const row of bookings) {
    await seedVenue(row.venue_name, row.venue_street)
    await seedVenue(row.venue_two_name, row.venue_two_street)
  }
  await ensureExternalDates()
  const externals = await query<{
    venue_name: string
    venue_street: string
    venue_two_name: string
    venue_two_street: string
  }>(
    'SELECT venue_name, venue_street, venue_two_name, venue_two_street FROM external_dates',
  )
  for (const row of externals) {
    await seedVenue(row.venue_name, row.venue_street)
    await seedVenue(row.venue_two_name, row.venue_two_street)
  }
  for (const wedding of SAVED_WEDDINGS) {
    await seedVenue(wedding.venueName, '')
  }
}

export async function listVenues(): Promise<SavedVenue[]> {
  await seedKnownVenues()
  const rows = await query<{ id: number; name: string; street: string }>(
    'SELECT id, name, street FROM venues ORDER BY lower(name), id',
  )
  return rows.map((row) => ({
    id: whole(row.id, 'Venue'),
    name: row.name,
    street: row.street,
  }))
}

export async function saveVenue(
  name: string,
  street: string,
): Promise<SavedVenue> {
  const cleanName = text(name, 160, 'The venue name')
  const cleanStreet = optional(street, 160)
  await showVenue(cleanName)
  const existing = await venueRow(cleanName)
  if (existing) {
    await query('UPDATE venues SET name = $1, street = $2 WHERE id = $3', [
      cleanName,
      cleanStreet,
      existing.id,
    ])
    return { id: existing.id, name: cleanName, street: cleanStreet }
  }
  const inserted = await query<{ id: number }>(
    'INSERT INTO venues (name, street) VALUES ($1, $2) RETURNING id',
    [cleanName, cleanStreet],
  )
  const id = inserted.at(0)?.id
  if (id == null) throw new Error('That venue was not saved.')
  return { id: whole(id, 'Venue'), name: cleanName, street: cleanStreet }
}

export async function updateVenue(
  id: number,
  name: string,
  street: string,
): Promise<SavedVenue> {
  const venueId = positiveId(id, 'That venue is not saved.')
  const cleanName = text(name, 160, 'The venue name')
  const cleanStreet = optional(street, 160)
  await ensureVenues()
  const current = await query<{ id: number; name: string }>(
    'SELECT id, name FROM venues WHERE id = $1',
    [venueId],
  )
  const row = current.at(0)
  if (!row) throw new Error('That venue is not saved.')
  const other = await venueRow(cleanName)
  if (other && other.id !== venueId) {
    throw new Error('That venue is already saved.')
  }
  await showVenue(cleanName)
  if (row.name.trim().toLowerCase() !== cleanName.toLowerCase()) {
    await query(
      `INSERT INTO hidden_venues (name)
       SELECT $1
       WHERE NOT EXISTS (SELECT 1 FROM hidden_venues WHERE name = $1)`,
      [row.name.trim().toLowerCase()],
    )
  }
  await query('UPDATE venues SET name = $1, street = $2 WHERE id = $3', [
    cleanName,
    cleanStreet,
    venueId,
  ])
  return { id: venueId, name: cleanName, street: cleanStreet }
}

export async function removeVenue(id: number): Promise<void> {
  const venueId = positiveId(id, 'That venue is not saved.')
  await ensureVenues()
  const rows = await query<{ name: string }>(
    'DELETE FROM venues WHERE id = $1 RETURNING name',
    [venueId],
  )
  const name = rows.at(0)?.name
  if (!name) throw new Error('That venue is not saved.')
  await query(
    `INSERT INTO hidden_venues (name)
     SELECT $1
     WHERE NOT EXISTS (SELECT 1 FROM hidden_venues WHERE name = $1)`,
    [name.trim().toLowerCase()],
  )
}

export async function createBooking(input: BookingInput): Promise<BookingView> {
  await ensureDiscountColumn()
  const next = normalize(input)
  await guardIdentity(
    next.partnerOne,
    next.partnerTwo,
    next.eventDate,
    next.stagDate,
  )
  await ensureDateFree(next.eventDate, next.stagDate, false, null)
  const prices = await packagePriceMap()
  const figures = figuresFor(
    {
      ...next,
      venueName: next.venueName,
      venueStreet: next.venueStreet,
    },
    prices,
  )
  const bookingSlug = slug()
  const invoiceSlug = slug()
  const inserted = await query<{ id: number }>(
    `INSERT INTO bookings (
      slug, partner_one, partner_two, email, phone, event_date, stag_date, package_id, with_stag,
      uplights, venue_km, venue_name, venue_street, venue_two_name, venue_two_street, sample,
      status, total_cents, deposit_cents, hold_started_on, stag_released, notes, discount_cents,
      custom_total_cents, locked_total
    ) VALUES (
      $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,'open',$17,$18,NULL,false,$19,$20,$21,$22
    ) RETURNING id`,
    [
      bookingSlug,
      next.partnerOne,
      next.partnerTwo,
      next.email,
      next.phone,
      next.eventDate,
      next.stagDate,
      next.packageId,
      next.withStag,
      next.uplights,
      JSON.stringify(next.venueKm),
      next.venueName,
      next.venueStreet,
      next.venueTwoName,
      next.venueTwoStreet,
      next.sample,
      figures.totalCents,
      figures.depositCents,
      next.notes,
      figures.discountCents,
      next.customTotalCents,
      next.lockedTotal,
    ],
  )
  const id = inserted.at(0)?.id
  if (!id) throw new Error('That booking was not saved.')
  await query(
    `INSERT INTO invoices (slug, booking_id, status, total_cents, deposit_cents, received_cents)
     VALUES ($1, $2, 'draft', $3, $4, 0)`,
    [invoiceSlug, id, figures.totalCents, figures.depositCents],
  )
  await rememberVenue(next.venueName, next.venueStreet)
  await rememberVenue(next.venueTwoName, next.venueTwoStreet)
  const row = await bookingRow(id)
  return present(toView(row, await invoiceFor(id)))
}

export type InquiryInput = {
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string
  packageId: string
  withStag: boolean
  stagDate: string | null
  message: string
  venueName?: string
  venueStreet?: string
  venueTwoName?: string
  venueTwoStreet?: string
  referral?: string
}

export async function createEventInquiry(input: {
  name: string
  email: string
  phone: string
  eventDate: string
  event: string
  message: string
}): Promise<{ ok: true; unavailable: boolean } | { ok: false; error: string }> {
  try {
    const email = text(input.email, 120, 'Email')
    if (!email.includes('@')) throw new Error('Enter an email address.')
    const name = text(input.name, 80, 'Your name')
    const event = text(input.event, 80, 'The event')
    const eventDate = input.eventDate.trim()
    if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
      throw new Error('Choose a date.')
    }
    const message = optional(input.message, 2000)
    const unavailable = await dateTakenByOthers(eventDate, null)
    await ensureLeadColumns()
    await query(
      `INSERT INTO leads (partner_one, partner_two, email, phone, event_date, package_id, with_stag, stag_date, message)
       VALUES ($1,$2,$3,$4,$5,$6,0,NULL,$7)`,
      [name, '', email, optional(input.phone, 40), eventDate, event, message],
    )
    return { ok: true, unavailable }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'That inquiry was not saved.',
    }
  }
}

export async function createInquiry(
  input: InquiryInput,
): Promise<{ ok: true; unavailable: boolean } | { ok: false; error: string }> {
  try {
    const email = text(input.email, 120, 'Email')
    if (!email.includes('@')) throw new Error('Enter an email address.')
    const partnerOne = text(input.partnerOne, 80, 'The first name')
    const partnerTwo = text(input.partnerTwo, 80, 'The second name')
    await guardIdentity(
      partnerOne,
      partnerTwo,
      input.eventDate,
      input.withStag ? input.stagDate : null,
    )
    const packageId = asPackage(input.packageId)
    if (input.withStag && packageId !== 'full') {
      throw new Error('A stag is added to the full wedding day.')
    }
    if (input.withStag && !input.stagDate)
      throw new Error('A stag needs its own date.')
    const message = optional(input.message, 2000)
    const stagDate = input.withStag ? input.stagDate : null
    const unavailable =
      (await dateTakenByOthers(input.eventDate, null)) ||
      (stagDate != null && (await dateTakenByOthers(stagDate, null)))
    await ensureLeadColumns()
    const venueName = optional(input.venueName ?? '', 160)
    const venueStreet = optional(input.venueStreet ?? '', 160)
    const venueTwoName = optional(input.venueTwoName ?? '', 160)
    const venueTwoStreet = optional(input.venueTwoStreet ?? '', 160)
    const referral = optional(input.referral ?? '', 160)
    await query(
      `INSERT INTO leads (partner_one, partner_two, email, phone, event_date, package_id, with_stag, stag_date, message,
        venue_name, venue_street, venue_two_name, venue_two_street, referral)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14)`,
      [
        partnerOne,
        partnerTwo,
        email,
        optional(input.phone, 40),
        input.eventDate,
        packageId,
        input.withStag ? 1 : 0,
        stagDate,
        message,
        venueName,
        venueStreet,
        venueTwoName,
        venueTwoStreet,
        referral,
      ],
    )
    if (!unavailable) {
      try {
        await createBooking({
          partnerOne,
          partnerTwo,
          email,
          phone: input.phone,
          eventDate: input.eventDate,
          stagDate,
          packageId,
          withStag: input.withStag,
          uplights: 0,
          venueKm: [],
          venueName,
          venueStreet,
          venueTwoName,
          venueTwoStreet,
          sample: false,
          notes: message,
        })
      } catch {
        // The lead is already saved. A booking problem must not hide the inquiry.
      }
    }
    return { ok: true, unavailable }
  } catch (error) {
    return {
      ok: false,
      error:
        error instanceof Error ? error.message : 'That inquiry was not saved.',
    }
  }
}

export async function dateOpen(day: string): Promise<boolean> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Choose a date.')
  if (isBlockedDate(day, null)) return false
  return !(await dateTakenByOthers(day, null))
}

function savedNames(partnerOne: string, partnerTwo: string): [string, string] {
  const names = [
    partnerOne.trim().toLowerCase(),
    partnerTwo.trim().toLowerCase(),
  ]
  names.sort()
  return [names.at(0) ?? '', names.at(1) ?? '']
}

function savedWeddingFor(
  partnerOne: string,
  partnerTwo: string,
  eventDate: string,
): (typeof SAVED_WEDDINGS)[number] | null {
  if (!matchCustom(partnerOne, partnerTwo, eventDate)) return null
  return SAVED_WEDDINGS.find((wedding) => wedding.date === eventDate) ?? null
}

async function ensureDismissedWeddings(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS dismissed_weddings (
      event_date text NOT NULL,
      partner_one text NOT NULL,
      partner_two text NOT NULL,
      PRIMARY KEY (event_date, partner_one, partner_two)
    )`,
  )
}

async function isSavedWeddingDismissed(
  wedding: (typeof SAVED_WEDDINGS)[number],
): Promise<boolean> {
  await ensureDismissedWeddings()
  const [one, two] = savedNames(wedding.partnerOne, wedding.partnerTwo)
  const rows = await query<{ event_date: string }>(
    `SELECT event_date FROM dismissed_weddings
     WHERE event_date = $1 AND partner_one = $2 AND partner_two = $3`,
    [wedding.date, one, two],
  )
  return rows.length > 0
}

async function dismissSavedWedding(
  wedding: (typeof SAVED_WEDDINGS)[number],
): Promise<void> {
  await ensureDismissedWeddings()
  const [one, two] = savedNames(wedding.partnerOne, wedding.partnerTwo)
  await query(
    `INSERT INTO dismissed_weddings (event_date, partner_one, partner_two)
     SELECT $1, $2, $3
     WHERE NOT EXISTS (
       SELECT 1 FROM dismissed_weddings
       WHERE event_date = $1 AND partner_one = $2 AND partner_two = $3
     )`,
    [wedding.date, one, two],
  )
}

type ExternalRow = {
  id: number
  event_date: string
  kind: string
  company: string
  label: string
  partner_one: string
  partner_two: string
  venue_name: string
  venue_street: string
  venue_two_name: string
  venue_two_street: string
  notes: string
  released: unknown
}

const EXTERNAL_COLUMNS = [
  'partner_one',
  'partner_two',
  'venue_name',
  'venue_street',
  'venue_two_name',
  'venue_two_street',
] as const

async function addExternalColumn(name: string): Promise<void> {
  try {
    await query(
      `ALTER TABLE external_dates ADD COLUMN ${name} text NOT NULL DEFAULT ''`,
    )
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/duplicate column|already exists/i.test(message)) return
    throw error
  }
}

async function ensureExternalDates(): Promise<void> {
  const definition = usesEdgeBook()
    ? `id integer PRIMARY KEY AUTOINCREMENT,
      event_date text NOT NULL,
      kind text NOT NULL,
      company text NOT NULL,
      label text NOT NULL DEFAULT '',
      notes text NOT NULL DEFAULT '',
      released integer NOT NULL DEFAULT 0`
    : `id integer GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
      event_date text NOT NULL,
      kind text NOT NULL,
      company text NOT NULL,
      label text NOT NULL DEFAULT '',
      notes text NOT NULL DEFAULT '',
      released integer NOT NULL DEFAULT 0`
  await query(`CREATE TABLE IF NOT EXISTS external_dates (${definition})`)
  for (const name of EXTERNAL_COLUMNS) await addExternalColumn(name)
}

function toExternal(row: ExternalRow): ExternalDate {
  return {
    id: whole(row.id, 'External date'),
    eventDate: row.event_date,
    kind: asExternalKind(row.kind),
    company: row.company,
    label: row.label,
    partnerOne: row.partner_one,
    partnerTwo: row.partner_two,
    venueName: row.venue_name,
    venueStreet: row.venue_street,
    venueTwoName: row.venue_two_name,
    venueTwoStreet: row.venue_two_street,
    notes: row.notes,
    released: flag(row.released),
  }
}

async function externalRow(id: number): Promise<ExternalDate> {
  await ensureExternalDates()
  const rows = await query<ExternalRow>(
    'SELECT * FROM external_dates WHERE id = $1',
    [id],
  )
  const row = rows.at(0)
  if (!row) throw new Error('That date is not on the book.')
  return toExternal(row)
}

export async function listExternalDates(): Promise<ExternalDate[]> {
  await ensureExternalDates()
  const rows = await query<ExternalRow>(
    'SELECT * FROM external_dates ORDER BY event_date, id',
  )
  return rows.map(toExternal)
}

export async function bookExternalDate(input: {
  eventDate: string
  kind: string
  company: string
  label: string
  notes: string
  partnerOne?: string
  partnerTwo?: string
  venueName?: string
  venueStreet?: string
  venueTwoName?: string
  venueTwoStreet?: string
}): Promise<ExternalDate> {
  const eventDate = input.eventDate.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    throw new Error('Choose a date.')
  }
  if (isBlockedDate(eventDate, null)) {
    throw new Error('20 February 2027 is not booked.')
  }
  const kind = asExternalKind(input.kind)
  const company = text(input.company, 80, 'The company')
  const label = optional(input.label, 80)
  const partnerOne = optional(input.partnerOne ?? '', 80)
  const partnerTwo = optional(input.partnerTwo ?? '', 80)
  const venueName = optional(input.venueName ?? '', 160)
  const venueStreet = optional(input.venueStreet ?? '', 160)
  const venueTwoName = optional(input.venueTwoName ?? '', 160)
  const venueTwoStreet = optional(input.venueTwoStreet ?? '', 160)
  const notes = optional(input.notes, 500)
  if (!(await dateOpen(eventDate))) {
    throw new Error('That date is already held.')
  }
  const inserted = await query<{ id: number }>(
    `INSERT INTO external_dates (
      event_date, kind, company, label, partner_one, partner_two,
      venue_name, venue_street, venue_two_name, venue_two_street, notes, released
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 0) RETURNING id`,
    [
      eventDate,
      kind,
      company,
      label,
      partnerOne,
      partnerTwo,
      venueName,
      venueStreet,
      venueTwoName,
      venueTwoStreet,
      notes,
    ],
  )
  const id = inserted.at(0)?.id
  if (id == null) throw new Error('That date was not saved.')
  await rememberVenue(venueName, venueStreet)
  await rememberVenue(venueTwoName, venueTwoStreet)
  return externalRow(whole(id, 'External date'))
}

export async function releaseExternalDate(id: number): Promise<ExternalDate> {
  const current = await externalRow(id)
  if (current.released) return current
  await query('UPDATE external_dates SET released = 1 WHERE id = $1', [
    current.id,
  ])
  return { ...current, released: true }
}

export async function removeExternalDate(id: number): Promise<void> {
  const current = await externalRow(id)
  const removed = await query<{ id: number }>(
    'DELETE FROM external_dates WHERE id = $1 RETURNING id',
    [current.id],
  )
  if (!removed.at(0)) throw new Error('That date is not on the book.')
}

export async function removeBooking(id: number): Promise<void> {
  const row = await bookingRow(id)
  const state = toState(row)
  const saved = savedWeddingFor(
    state.partnerOne,
    state.partnerTwo,
    state.eventDate,
  )
  if (saved) await dismissSavedWedding(saved)
  const invoice = await invoiceFor(row.id)
  if (invoice) {
    await query('DELETE FROM payments WHERE invoice_id = $1', [invoice.id])
    await query('DELETE FROM invoices WHERE id = $1', [invoice.id])
  }
  try {
    await query('DELETE FROM emails WHERE booking_id = $1', [row.id])
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/no such table|does not exist/i.test(message)) throw error
  }
  const removed = await query<{ id: number }>(
    'DELETE FROM bookings WHERE id = $1 RETURNING id',
    [row.id],
  )
  if (!removed.at(0)) throw new Error('That booking is not on the book.')
}

export type BookingPatch = {
  id: number
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string
  stagDate: string | null
  packageId: string
  withStag: boolean
  uplights: number
  venueKm: number[]
  venueName: string
  venueStreet: string
  venueTwoName: string
  venueTwoStreet: string
  sample: boolean
  notes: string
  discountCents?: number
  customTotalCents?: number
  customDepositCents?: number
  lockedTotal?: boolean
}

export async function updateBooking(patch: BookingPatch): Promise<BookingView> {
  const current = await bookingRow(patch.id)
  const state = toState(current)
  const next = normalize(patch)
  const savedWedding = matchCustom(
    state.partnerOne,
    state.partnerTwo,
    state.eventDate,
  )
  const locked = Boolean(state.lockedTotal) || Boolean(savedWedding)
  if (savedWedding) {
    assertBookableNames(next.partnerOne, next.partnerTwo)
    assertBookableDate(next.eventDate, next.stagDate)
  } else {
    await guardIdentity(
      next.partnerOne,
      next.partnerTwo,
      next.eventDate,
      next.stagDate,
    )
  }
  await ensureDateFree(
    next.eventDate,
    next.stagDate,
    state.stagReleased,
    current.id,
  )
  const prices = await packagePriceMap()
  if (locked && next.discountCents > 0) {
    throw new Error('That agreed total stays.')
  }
  const figures = locked
    ? {
        totalCents: state.totalCents,
        depositCents: state.depositCents,
        discountCents: 0,
      }
    : figuresFor(
        {
          partnerOne: next.partnerOne,
          partnerTwo: next.partnerTwo,
          eventDate: next.eventDate,
          stagDate: next.stagDate,
          packageId: next.packageId,
          withStag: next.withStag,
          uplights: next.uplights,
          venueKm: next.venueKm,
          venueName: next.venueName,
          venueStreet: next.venueStreet,
          sample: next.sample,
          discountCents: next.discountCents,
          customTotalCents: next.customTotalCents,
          customDepositCents: next.customDepositCents,
        },
        prices,
      )
  await query(
    `UPDATE bookings SET
      partner_one = $1, partner_two = $2, email = $3, phone = $4, event_date = $5, stag_date = $6,
      package_id = $7, with_stag = $8, uplights = $9, venue_km = $10, venue_name = $11,
      venue_street = $12, venue_two_name = $13, venue_two_street = $14, sample = $15, notes = $16,
      total_cents = $17, deposit_cents = $18, discount_cents = $19,
      custom_total_cents = $20, locked_total = $21
     WHERE id = $22`,
    [
      next.partnerOne,
      next.partnerTwo,
      next.email,
      next.phone,
      next.eventDate,
      next.stagDate,
      next.packageId,
      next.withStag,
      next.uplights,
      JSON.stringify(next.venueKm),
      next.venueName,
      next.venueStreet,
      next.venueTwoName,
      next.venueTwoStreet,
      next.sample,
      next.notes,
      figures.totalCents,
      figures.depositCents,
      figures.discountCents,
      locked ? (state.customTotalCents ?? 0) : next.customTotalCents,
      next.lockedTotal,
      current.id,
    ],
  )
  const invoiceRow = await invoiceFor(current.id)
  if (invoiceRow && invoiceRow.status !== 'void') {
    const invoice = toInvoice(invoiceRow)
    const updated: InvoiceState = {
      ...invoice,
      totalCents: figures.totalCents,
      depositCents: figures.depositCents,
    }
    const refreshed = toState(await bookingRow(current.id))
    const transition = recordMoney(refreshed, updated, 0, prices.ceremony)
    await saveBooking(current.id, transition.booking, transition.invoice)
  }
  await rememberVenue(next.venueName, next.venueStreet)
  await rememberVenue(next.venueTwoName, next.venueTwoStreet)
  return present(
    toView(await bookingRow(current.id), await invoiceFor(current.id)),
  )
}

export async function setBookingStatus(
  id: number,
  action: 'release' | 'cancel' | 'release-stag',
): Promise<BookingView> {
  const row = await bookingRow(id)
  const state = toState(row)
  const invoiceRow = await invoiceFor(id)
  const invoice = invoiceRow ? toInvoice(invoiceRow) : emptyInvoice(state)
  if (action === 'release-stag') {
    await query('UPDATE bookings SET stag_released = true WHERE id = $1', [id])
  } else {
    const transition =
      action === 'release'
        ? releaseBooking(state, invoice)
        : cancelBooking(state, invoice)
    await saveBooking(
      id,
      transition.booking,
      invoiceRow ? transition.invoice : null,
    )
  }
  return present(toView(await bookingRow(id), await invoiceFor(id)))
}

function emptyInvoice(state: BookingState): InvoiceState {
  return {
    status: 'draft',
    totalCents: state.totalCents,
    depositCents: state.depositCents,
    receivedCents: 0,
  }
}

export async function sendInvoice(
  bookingId: number,
): Promise<{ view: BookingView; newlyBooked: boolean }> {
  const row = await bookingRow(bookingId)
  const invoiceRow = await invoiceFor(bookingId)
  if (!invoiceRow) throw new Error('That booking has no invoice.')
  if (invoiceRow.status === 'void')
    throw new Error('A void invoice stays void.')
  const state = toState(row)
  const prices = await packagePriceMap()
  const transition = markInvoiceSent(
    state,
    toInvoice(invoiceRow),
    new Date(),
    prices.ceremony,
  )
  const enteringHold =
    state.status === 'open' && transition.booking.status !== 'open'
  const enteringBooked = transition.newlyBooked
  if (enteringHold || enteringBooked) {
    await ensureDateFree(
      state.eventDate,
      state.stagDate,
      state.stagReleased,
      row.id,
    )
  }
  await saveBooking(bookingId, transition.booking, transition.invoice)
  return {
    view: await present(
      toView(await bookingRow(bookingId), await invoiceFor(bookingId)),
    ),
    newlyBooked: transition.newlyBooked,
  }
}

export async function voidBookingInvoice(
  bookingId: number,
): Promise<BookingView> {
  const row = await bookingRow(bookingId)
  const invoiceRow = await invoiceFor(bookingId)
  if (!invoiceRow) throw new Error('That booking has no invoice.')
  const transition = voidInvoice(toState(row), toInvoice(invoiceRow))
  await saveBooking(bookingId, transition.booking, transition.invoice)
  return present(
    toView(await bookingRow(bookingId), await invoiceFor(bookingId)),
  )
}

export const PAYMENT_METHODS = ['e-transfer', 'cash', 'card'] as const

function paymentMethod(value: string | undefined): string {
  const method = (value ?? '').trim().slice(0, 20)
  if (method === '') return ''
  if (!(PAYMENT_METHODS as readonly string[]).includes(method)) {
    throw new Error('Choose e-transfer, cash, or card.')
  }
  return method
}

function paymentDate(value: string | undefined): string {
  const day = (value ?? '').trim()
  if (day === '') return ''
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Choose a payment date.')
  return day
}

export async function addPayment(
  bookingId: number,
  cents: number,
  note: string,
  paidOn = '',
  method = '',
  hstCents = 0,
): Promise<{
  view: BookingView
  newlyBooked: boolean
  paymentId: number | null
}> {
  if (!Number.isInteger(cents) || cents === 0)
    throw new Error('Enter an amount.')
  if (!Number.isInteger(hstCents) || hstCents < 0)
    throw new Error('HST must be whole cents.')
  await ensurePaymentColumns()
  const row = await bookingRow(bookingId)
  const invoiceRow = await invoiceFor(bookingId)
  if (!invoiceRow) throw new Error('That booking has no invoice.')
  if (invoiceRow.status === 'void')
    throw new Error('A void invoice does not take a payment.')
  const before = toInvoice(invoiceRow)
  const prices = await packagePriceMap()
  const transition = recordMoney(toState(row), before, cents, prices.ceremony)
  // A sample booking stays off the calendar, so it never clashes with one.
  if (transition.newlyBooked && !toState(row).sample) {
    const state = toState(row)
    await ensureDateFree(
      state.eventDate,
      state.stagDate,
      state.stagReleased,
      row.id,
    )
  }
  const applied = transition.invoice.receivedCents - before.receivedCents
  let paymentId: number | null = null
  if (applied !== 0) {
    const inserted = await query<{ id: number }>(
      'INSERT INTO payments (invoice_id, cents, note, paid_on, method, hst_cents) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id',
      [
        invoiceRow.id,
        applied,
        optional(note, 200),
        paymentDate(paidOn),
        paymentMethod(method),
        applied > 0 ? hstCents : 0,
      ],
    )
    paymentId = inserted.at(0)?.id ?? null
  }
  await saveBooking(bookingId, transition.booking, transition.invoice)
  return {
    view: await present(
      toView(await bookingRow(bookingId), await invoiceFor(bookingId)),
    ),
    newlyBooked: transition.newlyBooked,
    paymentId,
  }
}

async function ensureLeadColumns(): Promise<void> {
  await addLeadColumn('with_stag', 'integer NOT NULL DEFAULT 0')
  await addLeadColumn('stag_date', 'text')
  await addLeadColumn('venue_name', "text NOT NULL DEFAULT ''")
  await addLeadColumn('venue_street', "text NOT NULL DEFAULT ''")
  await addLeadColumn('venue_two_name', "text NOT NULL DEFAULT ''")
  await addLeadColumn('venue_two_street', "text NOT NULL DEFAULT ''")
  await addLeadColumn('referral', "text NOT NULL DEFAULT ''")
}

async function addLeadColumn(name: string, definition: string): Promise<void> {
  try {
    await query(`ALTER TABLE leads ADD COLUMN ${name} ${definition}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/duplicate column|already exists/i.test(message)) return
    throw error
  }
}

export async function listLeads(): Promise<LeadView[]> {
  await ensureLeadColumns()
  const offers = await listPackageOffers()
  const rows = await query<{
    id: number
    partner_one: string
    partner_two: string
    email: string
    phone: string
    event_date: string | null
    package_id: string
    with_stag: unknown
    stag_date: string | null
    message: string
  }>('SELECT * FROM leads ORDER BY id DESC')
  return rows.map((row) => ({
    id: row.id,
    partnerOne: row.partner_one,
    partnerTwo: row.partner_two,
    email: row.email,
    phone: row.phone,
    eventDate: row.event_date,
    packageId: row.package_id,
    packageName: offerName(offers, row.package_id),
    withStag: flag(row.with_stag),
    stagDate: row.stag_date,
    message: row.message,
  }))
}

export type LeadPatch = {
  id: number
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string
  packageId: string
  withStag: boolean
  stagDate: string | null
  message: string
}

export async function updateLead(input: LeadPatch): Promise<LeadView> {
  const id = positiveId(input.id, 'That inquiry is not on the desk.')
  await ensureLeadColumns()
  const existing = (await listLeads()).find((lead) => lead.id === id)
  if (!existing) throw new Error('That inquiry is not on the desk.')
  const email = text(input.email, 120, 'Email')
  if (!email.includes('@')) throw new Error('Enter an email address.')
  const partnerOne = text(input.partnerOne, 80, 'The first name')
  const partnerTwo = optional(input.partnerTwo, 80)
  const packageId = leadPackage(input.packageId)
  if (input.withStag && packageId !== 'full') {
    throw new Error('A stag is added to the full wedding day.')
  }
  if (input.withStag && !input.stagDate) {
    throw new Error('A stag needs its own date.')
  }
  const eventDate = input.eventDate.trim()
  if (eventDate && !/^\d{4}-\d{2}-\d{2}$/.test(eventDate)) {
    throw new Error('Choose a date.')
  }
  const stagDate = input.withStag ? input.stagDate : null
  await query(
    `UPDATE leads SET
      partner_one = $1, partner_two = $2, email = $3, phone = $4, event_date = $5,
      package_id = $6, with_stag = $7, stag_date = $8, message = $9
     WHERE id = $10`,
    [
      partnerOne,
      partnerTwo,
      email,
      optional(input.phone, 40),
      eventDate || null,
      packageId,
      input.withStag ? 1 : 0,
      stagDate,
      optional(input.message, 2000),
      id,
    ],
  )
  const saved = (await listLeads()).find((lead) => lead.id === id)
  if (!saved) throw new Error('That inquiry is not on the desk.')
  return saved
}

export async function removeLead(id: number): Promise<void> {
  const leadId = positiveId(id, 'That inquiry is not on the desk.')
  await ensureLeadColumns()
  const rows = await query<{ id: number }>(
    'DELETE FROM leads WHERE id = $1 RETURNING id',
    [leadId],
  )
  if (!rows.at(0)) throw new Error('That inquiry is not on the desk.')
}

export async function listPayments(): Promise<PaymentView[]> {
  await ensurePaymentColumns()
  const rows = await query<{
    id: number
    invoice_id: number
    booking_id: number
    partner_one: string
    partner_two: string
    cents: unknown
    note: string
    paid_on: string
    method: string
    hst_cents: unknown
  }>(
    `SELECT payments.id, payments.invoice_id, invoices.booking_id, bookings.partner_one, bookings.partner_two,
            payments.cents, payments.note, payments.paid_on, payments.method, payments.hst_cents
     FROM payments
     JOIN invoices ON invoices.id = payments.invoice_id
     JOIN bookings ON bookings.id = invoices.booking_id
     ORDER BY payments.id DESC`,
  )
  return rows.map((row) => ({
    id: row.id,
    invoiceId: row.invoice_id,
    bookingId: row.booking_id,
    names: `${row.partner_one} and ${row.partner_two}`,
    cents: whole(row.cents, 'Payment'),
    note: row.note,
    paidOn: row.paid_on,
    method: row.method,
    hstCents: Math.max(0, Number(row.hst_cents ?? 0) || 0),
  }))
}

/** One booking's payments, oldest first, for receipts. */
export async function paymentsForBooking(
  bookingId: number,
): Promise<PaymentView[]> {
  return (await listPayments())
    .filter((payment) => payment.bookingId === bookingId)
    .sort((a, b) => a.id - b.id)
}

async function paymentRow(id: number): Promise<{
  id: number
  invoiceId: number
  bookingId: number
  cents: number
  paidOn: string
  method: string
}> {
  const paymentId = positiveId(id, 'That payment is not on the book.')
  const rows = await query<{
    id: number
    invoice_id: number
    booking_id: number
    cents: unknown
    paid_on: string
    method: string
  }>(
    `SELECT payments.id, payments.invoice_id, invoices.booking_id, payments.cents,
            payments.paid_on, payments.method
     FROM payments
     JOIN invoices ON invoices.id = payments.invoice_id
     WHERE payments.id = $1`,
    [paymentId],
  )
  const row = rows.at(0)
  if (!row) throw new Error('That payment is not on the book.')
  return {
    id: whole(row.id, 'Payment'),
    invoiceId: whole(row.invoice_id, 'Invoice'),
    bookingId: whole(row.booking_id, 'Booking'),
    cents: whole(row.cents, 'Payment'),
    paidOn: row.paid_on,
    method: row.method,
  }
}

/** A payment edit can book a date. It never unbooks one. */
async function syncPaymentLedger(bookingId: number): Promise<void> {
  const invoiceRow = await invoiceFor(bookingId)
  if (!invoiceRow) return
  const sums = await query<{ total: unknown }>(
    'SELECT COALESCE(SUM(cents), 0) AS total FROM payments WHERE invoice_id = $1',
    [invoiceRow.id],
  )
  const received = Math.max(0, whole(sums.at(0)?.total ?? 0, 'Payment'))
  const before = toInvoice(invoiceRow)
  const booking = toState(await bookingRow(bookingId))
  if (received >= before.receivedCents) {
    const prices = await packagePriceMap()
    const transition = recordMoney(
      booking,
      before,
      received - before.receivedCents,
      prices.ceremony,
    )
    await saveBooking(bookingId, transition.booking, transition.invoice)
    return
  }
  await query('UPDATE invoices SET received_cents = $1 WHERE id = $2', [
    received,
    invoiceRow.id,
  ])
}

export async function updatePayment(
  id: number,
  cents: number,
  note: string,
  paidOn?: string,
  method?: string,
): Promise<PaymentView> {
  if (!Number.isInteger(cents) || cents === 0)
    throw new Error('Enter an amount.')
  await ensurePaymentColumns()
  const current = await paymentRow(id)
  await query(
    'UPDATE payments SET cents = $1, note = $2, paid_on = $3, method = $4 WHERE id = $5',
    [
      cents,
      optional(note, 200),
      paidOn === undefined ? current.paidOn : paymentDate(paidOn),
      method === undefined ? current.method : paymentMethod(method),
      current.id,
    ],
  )
  await syncPaymentLedger(current.bookingId)
  const saved = (await listPayments()).find(
    (payment) => payment.id === current.id,
  )
  if (!saved) throw new Error('That payment is not on the book.')
  return saved
}

export async function removePayment(id: number): Promise<void> {
  const current = await paymentRow(id)
  await query('DELETE FROM payments WHERE id = $1', [current.id])
  await syncPaymentLedger(current.bookingId)
}

async function ensureSite(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS site (
      id integer PRIMARY KEY CHECK (id = 1),
      kind_words integer NOT NULL DEFAULT 0
    )`,
  )
  await query(
    'INSERT INTO site (id, kind_words) VALUES (1, 0) ON CONFLICT (id) DO NOTHING',
  )
}

/** The wedding page Kind Words section. Missing or unset means off. */
export async function kindWordsOn(): Promise<boolean> {
  await ensureSite()
  const rows = await query<{ kind_words: unknown }>(
    'SELECT kind_words FROM site WHERE id = 1',
  )
  return flag(rows.at(0)?.kind_words)
}

export async function setKindWords(on: boolean): Promise<boolean> {
  await ensureSite()
  await query('UPDATE site SET kind_words = $1 WHERE id = 1', [on ? 1 : 0])
  return kindWordsOn()
}

async function ensureProfileColumns(): Promise<void> {
  await ensureSite()
  await addSiteColumn('owner_email', 'text')
  await addSiteColumn('home_base', 'text')
}

async function addSiteColumn(name: string, definition: string): Promise<void> {
  try {
    await query(`ALTER TABLE site ADD COLUMN ${name} ${definition}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/duplicate column|already exists/i.test(message)) return
    throw error
  }
}

export async function deskProfile(): Promise<{
  email: string
  homeBase: string
}> {
  await ensureProfileColumns()
  const rows = await query<{
    owner_email: string | null
    home_base: string | null
  }>('SELECT owner_email, home_base FROM site WHERE id = 1')
  const row = rows.at(0)
  if (!row) {
    return { email: DESK_OWNER_EMAIL, homeBase: HOME_BASE }
  }
  return {
    email: (row.owner_email ?? '').trim() || DESK_OWNER_EMAIL,
    homeBase: (row.home_base ?? '').trim() || HOME_BASE,
  }
}

export async function saveDeskProfile(input: {
  email: string
  homeBase: string
}): Promise<{ email: string; homeBase: string }> {
  await ensureProfileColumns()
  const email = text(input.email, 120, 'The desk email')
  if (!email.includes('@')) throw new Error('Enter an email address.')
  const homeBase = text(input.homeBase, 120, 'The home base')
  await query('UPDATE site SET owner_email = $1, home_base = $2 WHERE id = 1', [
    email,
    homeBase,
  ])
  return deskProfile()
}

async function addReviewColumn(
  name: string,
  definition: string,
): Promise<void> {
  try {
    await query(`ALTER TABLE reviews ADD COLUMN ${name} ${definition}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (/duplicate column|already exists/i.test(message)) return
    throw error
  }
}

async function ensureReviews(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS reviews (
      id integer PRIMARY KEY,
      quote text NOT NULL,
      names text NOT NULL DEFAULT '',
      when_label text NOT NULL DEFAULT ''
    )`,
  )
  await addReviewColumn('event_type', `text NOT NULL DEFAULT ''`)
  await addReviewColumn('town', `text NOT NULL DEFAULT ''`)
  await addReviewColumn('reviewed_on', `text NOT NULL DEFAULT ''`)
  await addReviewColumn('source', `text NOT NULL DEFAULT 'other'`)
  await addReviewColumn('show_on_site', `integer NOT NULL DEFAULT 0`)
}

type ReviewRow = {
  id: number
  quote: string
  names: string
  event_type: string
  town: string
  reviewed_on: string
  source: string
  show_on_site: unknown
}

function toReview(row: ReviewRow): ReviewView {
  const source: ReviewSource = isReviewSource(row.source) ? row.source : 'other'
  return {
    id: whole(row.id, 'Review'),
    quote: row.quote,
    names: row.names,
    eventType: row.event_type,
    town: row.town,
    date: row.reviewed_on,
    source,
    show: flag(row.show_on_site),
  }
}

const REVIEW_COLUMNS =
  'id, quote, names, event_type, town, reviewed_on, source, show_on_site'

function reviewId(id: number): number {
  if (!Number.isInteger(id) || id < 1) {
    throw new Error('That review is not on the page.')
  }
  return id
}

function parseReview(input: ReviewDraft): Omit<ReviewView, 'id'> {
  const quote = input.quote.trim()
  const names = input.names.trim()
  const eventType = input.eventType.trim()
  const town = input.town.trim()
  const date = input.date.trim()
  if (!quote) throw new Error('The review is required.')
  if (quote.length > 800) throw new Error('That review is too long.')
  if (names.length > 80) throw new Error('That name is too long.')
  if (eventType.length > 80) throw new Error('That event type is too long.')
  if (town.length > 80) throw new Error('That town is too long.')
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date))
    throw new Error('The date is required.')
  const [year, month, day] = date.split('-').map(Number)
  const parsed = new Date(Date.UTC(year, month - 1, day))
  if (
    parsed.getUTCFullYear() !== year ||
    parsed.getUTCMonth() !== month - 1 ||
    parsed.getUTCDate() !== day
  ) {
    throw new Error('That date is not valid.')
  }
  if (!isReviewSource(input.source)) {
    throw new Error('Choose where the review came from.')
  }
  return {
    quote,
    names,
    eventType,
    town,
    date,
    source: input.source,
    show: input.show,
  }
}

export async function listReviews(): Promise<ReviewView[]> {
  await ensureReviews()
  const rows = await query<ReviewRow>(
    `SELECT ${REVIEW_COLUMNS} FROM reviews ORDER BY reviewed_on DESC, id DESC`,
  )
  return rows.map(toReview)
}

/** Public cards. Only reviews switched on, newest first. */
export async function homepageReviews(): Promise<PublicReview[]> {
  const reviews = await listReviews()
  return reviews
    .filter((review) => review.show)
    .map((review) => ({
      id: review.id,
      quote: review.quote,
      names: review.names,
      eventType: review.eventType,
      town: review.town,
      date: review.date,
      source: review.source,
    }))
}

export async function addReview(input: ReviewDraft): Promise<ReviewView> {
  await ensureReviews()
  const review = parseReview(input)
  const ids = await query<{ id: number }>(
    'SELECT COALESCE(MAX(id), 0) + 1 AS id FROM reviews',
  )
  const id = whole(ids.at(0)?.id, 'Review')
  await query(
    `INSERT INTO reviews (id, quote, names, when_label, event_type, town, reviewed_on, source, show_on_site)
     VALUES ($1, $2, $3, '', $4, $5, $6, $7, $8)`,
    [
      id,
      review.quote,
      review.names,
      review.eventType,
      review.town,
      review.date,
      review.source,
      review.show ? 1 : 0,
    ],
  )
  await forgetPublicSite()
  return { id, ...review }
}

export async function updateReview(
  id: number,
  input: ReviewDraft,
): Promise<ReviewView> {
  const reviewIdValue = reviewId(id)
  await ensureReviews()
  const review = parseReview(input)
  const rows = await query<ReviewRow>(
    `UPDATE reviews
     SET quote = $1, names = $2, event_type = $3, town = $4, reviewed_on = $5, source = $6, show_on_site = $7
     WHERE id = $8
     RETURNING ${REVIEW_COLUMNS}`,
    [
      review.quote,
      review.names,
      review.eventType,
      review.town,
      review.date,
      review.source,
      review.show ? 1 : 0,
      reviewIdValue,
    ],
  )
  const saved = rows.at(0)
  if (!saved) throw new Error('That review is not on the page.')
  await forgetPublicSite()
  return toReview(saved)
}

export async function setReviewShown(
  id: number,
  show: boolean,
): Promise<ReviewView> {
  const reviewIdValue = reviewId(id)
  await ensureReviews()
  const rows = await query<ReviewRow>(
    `UPDATE reviews SET show_on_site = $1 WHERE id = $2 RETURNING ${REVIEW_COLUMNS}`,
    [show ? 1 : 0, reviewIdValue],
  )
  const saved = rows.at(0)
  if (!saved) throw new Error('That review is not on the page.')
  await forgetPublicSite()
  return toReview(saved)
}

export async function removeReview(id: number): Promise<void> {
  const reviewIdValue = reviewId(id)
  await ensureReviews()
  await query('DELETE FROM reviews WHERE id = $1', [reviewIdValue])
  await forgetPublicSite()
}

export async function getTerms(): Promise<string> {
  const rows = await query<{ body: string }>(
    'SELECT body FROM terms WHERE id = 1',
  )
  const body = rows.at(0)?.body
  if (!body) throw new Error('The terms document is missing.')
  return body
}

export async function updateTerms(body: string): Promise<string> {
  const next = text(body, 20000, 'The terms')
  const rows = await query<{ body: string }>(
    'UPDATE terms SET body = $1 WHERE id = 1 RETURNING body',
    [next],
  )
  const saved = rows.at(0)?.body
  if (!saved) throw new Error('The terms document is missing.')
  return saved
}

export async function listQuestions(): Promise<
  { id: number; prompt: string }[]
> {
  return query<{ id: number; prompt: string }>(
    'SELECT id, prompt FROM questions ORDER BY sort, id',
  )
}

export async function addQuestion(prompt: string): Promise<void> {
  const next = text(prompt, 500, 'The question')
  const rows = await query<{ sort: number }>(
    'SELECT COALESCE(MAX(sort), 0) + 1 AS sort FROM questions',
  )
  const sort = whole(rows.at(0)?.sort ?? 1, 'Question')
  await query('INSERT INTO questions (prompt, sort) VALUES ($1, $2)', [
    next,
    sort,
  ])
}

export async function listMedia(): Promise<
  { id: number; title: string; url: string }[]
> {
  return query<{ id: number; title: string; url: string }>(
    'SELECT id, title, url FROM media ORDER BY id DESC',
  )
}

export async function addMedia(title: string, url: string): Promise<void> {
  const nextTitle = text(title, 120, 'A title')
  const nextUrl = text(url, 500, 'A link')
  await query('INSERT INTO media (title, url) VALUES ($1, $2)', [
    nextTitle,
    nextUrl,
  ])
}

export async function updateQuestion(
  id: number,
  prompt: string,
): Promise<{ id: number; prompt: string }> {
  const questionId = positiveId(id, 'That question is not on the desk.')
  const next = text(prompt, 500, 'The question')
  const rows = await query<{ id: number; prompt: string }>(
    'UPDATE questions SET prompt = $1 WHERE id = $2 RETURNING id, prompt',
    [next, questionId],
  )
  const saved = rows.at(0)
  if (!saved) throw new Error('That question is not on the desk.')
  return { id: whole(saved.id, 'Question'), prompt: saved.prompt }
}

export async function removeQuestion(id: number): Promise<void> {
  const questionId = positiveId(id, 'That question is not on the desk.')
  const rows = await query<{ id: number }>(
    'DELETE FROM questions WHERE id = $1 RETURNING id',
    [questionId],
  )
  if (!rows.at(0)) throw new Error('That question is not on the desk.')
}

export async function updateMedia(
  id: number,
  title: string,
  url: string,
): Promise<{ id: number; title: string; url: string }> {
  const mediaId = positiveId(id, 'That link is not on the desk.')
  const nextTitle = text(title, 120, 'A title')
  const nextUrl = text(url, 500, 'A link')
  const rows = await query<{ id: number; title: string; url: string }>(
    'UPDATE media SET title = $1, url = $2 WHERE id = $3 RETURNING id, title, url',
    [nextTitle, nextUrl, mediaId],
  )
  const saved = rows.at(0)
  if (!saved) throw new Error('That link is not on the desk.')
  return { id: whole(saved.id, 'Media'), title: saved.title, url: saved.url }
}

export async function removeMedia(id: number): Promise<void> {
  const mediaId = positiveId(id, 'That link is not on the desk.')
  const rows = await query<{ id: number }>(
    'DELETE FROM media WHERE id = $1 RETURNING id',
    [mediaId],
  )
  if (!rows.at(0)) throw new Error('That link is not on the desk.')
}

const PACKAGE_ORDER: PackageId[] = ['full', 'reception', 'stag', 'ceremony']

const PACKAGE_OFFER_TABLE = `CREATE TABLE IF NOT EXISTS package_offers (
  id text PRIMARY KEY,
  name text NOT NULL,
  detail text NOT NULL,
  cents integer NOT NULL
)`

type OfferRow = {
  id: string
  name: string
  detail: string
  cents: unknown
}

function offersFromRows(rows: OfferRow[]): PackageOffer[] {
  const byId = new Map(rows.map((row) => [row.id, row]))
  return PACKAGE_ORDER.map((id) => {
    const row = byId.get(id)
    const copy = PACKAGE_BUTTON_COPY.find((item) => item.id === id)
    return {
      id,
      name: row?.name || copy?.name || id,
      detail: row?.detail || copy?.detail || '',
      cents: row ? whole(row.cents, 'Price') : PACKAGE_CENTS[id],
    }
  })
}

async function ensurePackageOffers(): Promise<void> {
  await query(PACKAGE_OFFER_TABLE)
  for (const item of PACKAGE_BUTTON_COPY) {
    await query(
      `INSERT INTO package_offers (id, name, detail, cents)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (id) DO NOTHING`,
      [item.id, item.name, item.detail, PACKAGE_CENTS[item.id]],
    )
  }
}

export async function listPackageOffers(): Promise<PackageOffer[]> {
  const results = await queryBatch([
    { sql: PACKAGE_OFFER_TABLE },
    { sql: 'SELECT id, name, detail, cents FROM package_offers' },
    { sql: REVIEW_DISPLAY_TABLE },
    { sql: 'SELECT page, mode FROM review_display' },
  ])
  return offersFromRows(results[1] as OfferRow[])
}

/** One Book call: the token and the four packages. Null when the token is not on this book. */
export async function packagesForToken(
  token: string,
): Promise<PackageOffer[] | null> {
  if (!token) return null
  const results = await queryBatch([
    {
      sql: 'SELECT role FROM bots WHERE token = $1',
      params: [token],
    },
    { sql: PACKAGE_OFFER_TABLE },
    { sql: 'SELECT id, name, detail, cents FROM package_offers' },
  ])
  const role = results.at(0)?.at(0)?.role
  if (typeof role !== 'string') return null
  asRole(role)
  return offersFromRows(results[2] as OfferRow[])
}

export async function packagePriceMap(): Promise<Record<PackageId, number>> {
  const offers = await listPackageOffers()
  const price = (id: PackageId) => {
    const offer = offers.find((item) => item.id === id)
    return offer ? offer.cents : PACKAGE_CENTS[id]
  }
  return {
    full: price('full'),
    reception: price('reception'),
    stag: price('stag'),
    ceremony: price('ceremony'),
    custom: price('custom'),
  }
}

export async function updatePackageOffer(input: {
  id: string
  name: string
  detail: string
  cents: number
}): Promise<PackageOffer> {
  if (!isPackageId(input.id)) throw new Error('Choose a package.')
  const name = text(input.name, 80, 'The package name')
  const detail = text(input.detail, 2000, 'The package detail')
  if (
    !Number.isInteger(input.cents) ||
    input.cents < 0 ||
    input.cents > 10_000_000
  ) {
    throw new Error('Enter a price in cents.')
  }
  await ensurePackageOffers()
  const rows = await query<{ id: string }>(
    `UPDATE package_offers SET name = $1, detail = $2, cents = $3
     WHERE id = $4 RETURNING id`,
    [name, detail, input.cents, input.id],
  )
  if (!rows.at(0)) throw new Error('Choose a package.')
  const saved = (await listPackageOffers()).find((item) => item.id === input.id)
  if (!saved) throw new Error('Choose a package.')
  await forgetPublicSite()
  return saved
}

function offerName(offers: PackageOffer[], id: string): string {
  return (
    offers.find((item) => item.id === id)?.name ??
    (isPackageId(id) ? packageName(id) : id)
  )
}

function namedView(view: BookingView, offers: PackageOffer[]): BookingView {
  return { ...view, packageName: offerName(offers, view.packageId) }
}

async function present(view: BookingView): Promise<BookingView> {
  return namedView(view, await listPackageOffers())
}

function positiveId(id: number, missing: string): number {
  if (!Number.isInteger(id) || id < 1) throw new Error(missing)
  return id
}

const PARTNER_MIMES = new Set(['image/png', 'image/jpeg', 'image/webp'])

async function ensurePartners(): Promise<void> {
  await query(
    `CREATE TABLE IF NOT EXISTS partners (
      id integer PRIMARY KEY,
      name text NOT NULL,
      href text NOT NULL,
      mime text NOT NULL,
      logo text NOT NULL
    )`,
  )
}

function partnerWebsite(value: string): string {
  const next = text(value, 300, 'A website')
  let url: URL
  try {
    url = new URL(next)
  } catch {
    throw new Error('Enter a full website address, starting with https://.')
  }
  if (url.protocol !== 'https:' && url.protocol !== 'http:') {
    throw new Error('Enter a full website address, starting with https://.')
  }
  return url.toString()
}

function partnerLogoData(value: string): { mime: string; logo: string } {
  const match =
    /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
      value.trim(),
    )
  if (!match) throw new Error('Use a PNG, JPEG, or WebP logo.')
  const [, mime = '', encodedLogo = ''] = match
  const logo = encodedLogo.replace(/\s/g, '')
  if (!PARTNER_MIMES.has(mime) || !logo) {
    throw new Error('Use a PNG, JPEG, or WebP logo.')
  }
  if (logo.length > 280_000)
    throw new Error('That logo is too large. Keep it under 200 KB.')
  return { mime, logo }
}

export type PartnerView = {
  id: number
  name: string
  href: string
  src: string
}

export async function listPartners(): Promise<PartnerView[]> {
  await ensurePartners()
  const rows = await query<{
    id: number
    name: string
    href: string
    mime: string
    logo: string
  }>('SELECT id, name, href, mime, logo FROM partners ORDER BY id')
  return rows.map((row) => ({
    id: whole(row.id, 'Partner'),
    name: row.name,
    href: row.href,
    src: `data:${row.mime};base64,${row.logo}`,
  }))
}

export type PublicCatalog = {
  reviews: PublicReview[]
  partners: PartnerView[]
  packages: PackageOffer[]
  /** Which reviews each page shows: Google's, the owner's, or both. */
  reviewDisplay: Record<ReviewPage, ReviewDisplay>
}

const REVIEW_DISPLAY_TABLE = `CREATE TABLE IF NOT EXISTS review_display (
  page text PRIMARY KEY,
  mode text NOT NULL
)`

export function reviewDisplayFrom(
  rows: { page: string; mode: string }[],
): Record<ReviewPage, ReviewDisplay> {
  const display: Record<ReviewPage, ReviewDisplay> = {
    home: 'both',
    weddings: 'both',
  }
  for (const row of rows) {
    if ((row.page === 'home' || row.page === 'weddings') && isReviewDisplay(row.mode)) {
      display[row.page] = row.mode
    }
  }
  return display
}

export async function readReviewDisplay(): Promise<
  Record<ReviewPage, ReviewDisplay>
> {
  await query(REVIEW_DISPLAY_TABLE)
  return reviewDisplayFrom(
    await query<{ page: string; mode: string }>(
      'SELECT page, mode FROM review_display',
    ),
  )
}

export async function setReviewDisplay(
  page: ReviewPage,
  mode: ReviewDisplay,
): Promise<Record<ReviewPage, ReviewDisplay>> {
  await query(REVIEW_DISPLAY_TABLE)
  await query(
    `INSERT INTO review_display (page, mode) VALUES ($1, $2)
     ON CONFLICT (page) DO UPDATE SET mode = EXCLUDED.mode`,
    [page, mode],
  )
  return readReviewDisplay()
}

/** Reviews, partners, and packages in one Book call. */
export async function loadPublicCatalog(): Promise<PublicCatalog> {
  const results = await queryBatch([
    {
      sql: `SELECT ${REVIEW_COLUMNS} FROM reviews
            WHERE show_on_site <> 0
            ORDER BY reviewed_on DESC, id DESC`,
    },
    { sql: 'SELECT id, name, href, mime, logo FROM partners ORDER BY id' },
    { sql: PACKAGE_OFFER_TABLE },
    { sql: 'SELECT id, name, detail, cents FROM package_offers' },
  ])
  const reviews = (results[0] as ReviewRow[]).map((row) => {
    const source: ReviewSource = isReviewSource(row.source)
      ? row.source
      : 'other'
    return {
      id: whole(row.id, 'Review'),
      quote: row.quote,
      names: row.names,
      eventType: row.event_type,
      town: row.town,
      date: row.reviewed_on,
      source,
    }
  })
  const partners = (
    results[1] as {
      id: number
      name: string
      href: string
      mime: string
      logo: string
    }[]
  ).map((row) => ({
    id: whole(row.id, 'Partner'),
    name: row.name,
    href: row.href,
    src: `data:${row.mime};base64,${row.logo}`,
  }))
  return {
    reviews,
    partners,
    packages: offersFromRows(results[3] as OfferRow[]),
    reviewDisplay: reviewDisplayFrom(
      (results[5] ?? []) as { page: string; mode: string }[],
    ),
  }
}

export async function partnerLogo(
  id: number,
): Promise<{ mime: string; logo: string } | null> {
  if (!Number.isInteger(id) || id < 1) return null
  await ensurePartners()
  const rows = await query<{ mime: string; logo: string }>(
    'SELECT mime, logo FROM partners WHERE id = $1',
    [id],
  )
  const row = rows.at(0)
  if (!row || !PARTNER_MIMES.has(row.mime)) return null
  return row
}

export async function addPartner(input: {
  name: string
  href: string
  logo: string
}): Promise<PartnerView> {
  await ensurePartners()
  const name = text(input.name, 80, 'A brand name')
  const href = partnerWebsite(input.href)
  const { mime, logo } = partnerLogoData(input.logo)
  const ids = await query<{ id: number }>(
    'SELECT COALESCE(MAX(id), 0) + 1 AS id FROM partners',
  )
  const id = whole(ids.at(0)?.id, 'Partner')
  await query(
    'INSERT INTO partners (id, name, href, mime, logo) VALUES ($1, $2, $3, $4, $5)',
    [id, name, href, mime, logo],
  )
  await forgetPublicSite()
  return { id, name, href, src: `data:${mime};base64,${logo}` }
}

export async function removePartner(id: number): Promise<void> {
  if (!Number.isInteger(id) || id < 1)
    throw new Error('That brand is not on the page.')
  await ensurePartners()
  await query('DELETE FROM partners WHERE id = $1', [id])
  await forgetPublicSite()
}

export async function updatePartner(input: {
  id: number
  name: string
  href: string
  logo?: string
}): Promise<PartnerView> {
  const id = positiveId(input.id, 'That brand is not on the page.')
  await ensurePartners()
  const current = (await listPartners()).find((partner) => partner.id === id)
  if (!current) throw new Error('That brand is not on the page.')
  const name = text(input.name, 80, 'A brand name')
  const href = partnerWebsite(input.href)
  const replacement = input.logo?.trim() ? partnerLogoData(input.logo) : null
  if (replacement) {
    await query(
      'UPDATE partners SET name = $1, href = $2, mime = $3, logo = $4 WHERE id = $5',
      [name, href, replacement.mime, replacement.logo, id],
    )
  } else {
    await query('UPDATE partners SET name = $1, href = $2 WHERE id = $3', [
      name,
      href,
      id,
    ])
  }
  const saved = (await listPartners()).find((partner) => partner.id === id)
  if (!saved) throw new Error('That brand is not on the page.')
  await forgetPublicSite()
  return saved
}

export async function listBots(): Promise<
  { id: number; name: string; role: BotRole }[]
> {
  const rows = await query<{ id: number; name: string; role: string }>(
    'SELECT id, name, role FROM bots ORDER BY id',
  )
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: asRole(row.role),
  }))
}

function asRole(value: string): BotRole {
  if (value === 'reader' || value === 'writer' || value === 'ceo') return value
  throw new Error('That role is not on an invite.')
}

export async function updateBot(
  id: number,
  name: string,
  role: string,
): Promise<{ id: number; name: string; role: BotRole }> {
  const botId = positiveId(id, 'That bot is not on the desk.')
  const nextName = text(name, 80, 'A name')
  const nextRole = asRole(role)
  const rows = await query<{ id: number }>(
    'UPDATE bots SET name = $1, role = $2 WHERE id = $3 RETURNING id',
    [nextName, nextRole, botId],
  )
  if (!rows.at(0)) throw new Error('That bot is not on the desk.')
  return { id: botId, name: nextName, role: nextRole }
}

export async function removeBot(id: number): Promise<void> {
  const botId = positiveId(id, 'That bot is not on the desk.')
  const rows = await query<{ id: number }>(
    'DELETE FROM bots WHERE id = $1 RETURNING id',
    [botId],
  )
  if (!rows.at(0)) throw new Error('That bot is not on the desk.')
}

export async function inviteBot(
  name: string,
  role: string,
): Promise<{ token: string }> {
  const nextName = text(name, 80, 'A name')
  const nextRole = asRole(role)
  const token = randomBytes(24).toString('hex')
  await query('INSERT INTO bots (name, token, role) VALUES ($1, $2, $3)', [
    nextName,
    token,
    nextRole,
  ])
  return { token }
}

export async function botFromToken(
  token: string,
): Promise<{ id: number; name: string; role: BotRole } | null> {
  if (!token) return null
  const rows = await query<{ id: number; name: string; role: string }>(
    'SELECT id, name, role FROM bots WHERE token = $1',
    [token],
  )
  const row = rows.at(0)
  if (!row) return null
  return { id: row.id, name: row.name, role: asRole(row.role) }
}

function planningSeed(row: BookingRow): PlanningSeed {
  const ceremony = row.venue_street.trim()
  const receptionStreet = row.venue_two_street.trim()
  return {
    coupleNames: `${row.partner_one} and ${row.partner_two}`,
    email: row.email,
    phone: row.phone,
    weddingDate: longDate(row.event_date),
    venueName: row.venue_name,
    ceremonyAddress: ceremony,
    receptionAddress: receptionStreet || ceremony,
  }
}

const SUGGESTION_SEED: PlanningSeed = {
  coupleNames: '',
  email: '',
  phone: '',
  weddingDate: '',
  venueName: '',
}

export async function suggestionsForCouple(
  slugValue: string,
  presetKey: string,
): Promise<SongHit[]> {
  await ensurePlanningColumn()
  const rows = await query<{
    slug: string
    sample?: unknown
    planning?: string
  }>('SELECT slug, sample, planning FROM bookings')
  const plans = rows.map((row) => ({
    slug: row.slug,
    sample: flag(row.sample),
    timeline: parsePlanning(row.planning, SUGGESTION_SEED).planning.timeline,
  }))
  return rankSuggestions(presetKey, songsFromPlans(plans, slugValue))
}

export async function coupleBySlug(slugValue: string) {
  await ensurePlanningColumn()
  await ensureDiscountColumn()
  const rows = await query<BookingRow & { planning?: string }>(
    'SELECT * FROM bookings WHERE slug = $1',
    [slugValue],
  )
  const row = rows.at(0)
  if (!row) return null
  const view = await present(toView(row, await invoiceFor(row.id)))
  const planning = parsePlanning(row.planning, planningSeed(row))
  return {
    partnerOne: view.partnerOne,
    partnerTwo: view.partnerTwo,
    eventDate: view.eventDate,
    stagDate: view.stagDate,
    stagReleased: view.stagReleased,
    packageName: view.packageName,
    withStag: view.withStag,
    status: view.status,
    sample: view.sample,
    venueName: view.venueName,
    venueTwoName: view.venueTwoName,
    holdStartedOn: view.holdStartedOn,
    holdLastDay: view.holdLastDay,
    totalCents: view.invoice?.totalCents ?? view.totalCents,
    depositCents: view.invoice?.depositCents ?? view.depositCents,
    discountCents: view.discountCents,
    receivedCents: view.invoice?.receivedCents ?? 0,
    balanceCents: view.invoice?.balanceCents ?? view.totalCents,
    invoiceStatus: view.invoice?.status ?? null,
    invoiceSlug: view.invoice?.slug ?? null,
    planning: planning.planning,
    planningSaved: planning.saved,
  }
}

export async function saveCouplePlanning(
  slugValue: string,
  value: unknown,
): Promise<Planning> {
  await ensurePlanningColumn()
  const rows = await query<BookingRow & { planning?: string }>(
    'SELECT * FROM bookings WHERE slug = $1',
    [slugValue],
  )
  const row = rows.at(0)
  if (!row) throw new Error('That page was not found.')
  const existing = parsePlanning(row.planning, planningSeed(row)).planning
  if (isPlanLocked(existing, torontoToday())) {
    throw new Error('This plan is locked.')
  }
  const planning = mergeCoupleSave(
    existing,
    planningFromUnknown(value, planningSeed(row)),
  )
  await query('UPDATE bookings SET planning = $1 WHERE id = $2', [
    JSON.stringify(planning),
    row.id,
  ])
  return planning
}

export async function savePortalDeskFields(
  slugValue: string,
  fields: { arrivalTime: string; dueDate: string; unlock: boolean },
): Promise<Planning> {
  await ensurePlanningColumn()
  const rows = await query<BookingRow & { planning?: string }>(
    'SELECT * FROM bookings WHERE slug = $1',
    [slugValue],
  )
  const row = rows.at(0)
  if (!row) throw new Error('That page was not found.')
  const existing = parsePlanning(row.planning, planningSeed(row)).planning
  const planning = {
    ...existing,
    arrivalTime: clipPortal(fields.arrivalTime, 200),
    dueDate: /^\d{4}-\d{2}-\d{2}$/.test(fields.dueDate) ? fields.dueDate : '',
    planLocked: fields.unlock ? false : existing.planLocked,
  }
  await query('UPDATE bookings SET planning = $1 WHERE id = $2', [
    JSON.stringify(planning),
    row.id,
  ])
  return planning
}

const PASSCODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'

async function ensurePortalColumns(): Promise<void> {
  await ensureSite()
  await addSiteColumn('portal_master', 'text')
  await addBookingColumn('portal_passcode', `text NOT NULL DEFAULT ''`)
  await addBookingColumn('portal_share', `text NOT NULL DEFAULT ''`)
  await addBookingColumn('portal_share_on', `integer NOT NULL DEFAULT 0`)
}

async function addBookingColumn(name: string, type: string): Promise<void> {
  try {
    await query(`ALTER TABLE bookings ADD COLUMN ${name} ${type}`)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    if (!/duplicate column|already exists/i.test(message)) throw error
  }
}

function makePasscode(): string {
  const bytes = randomBytes(6)
  let code = ''
  for (let index = 0; index < 6; index += 1) {
    code += PASSCODE_ALPHABET[bytes[index] % PASSCODE_ALPHABET.length]
  }
  return code
}

function unusedPasscode(taken: Set<string>): string {
  for (let attempt = 0; attempt < 20; attempt += 1) {
    const code = makePasscode()
    if (!taken.has(code)) return code
  }
  throw new Error('Could not make a passcode.')
}

export async function readPortalMaster(): Promise<MasterMap> {
  await ensurePortalColumns()
  const rows = await query<{ portal_master: string | null }>(
    'SELECT portal_master FROM site WHERE id = 1',
  )
  return parseMaster(rows.at(0)?.portal_master ?? '')
}

export async function savePortalMaster(value: unknown): Promise<MasterMap> {
  await ensurePortalColumns()
  const master = parseMaster(value)
  await query('UPDATE site SET portal_master = $1 WHERE id = 1', [
    JSON.stringify(master),
  ])
  return master
}

export async function listCouplePortals() {
  await ensurePlanningColumn()
  await ensurePortalColumns()
  const master = await readPortalMaster()
  const rows = await query<
    BookingRow & { planning?: string; portal_passcode?: string }
  >('SELECT * FROM bookings ORDER BY event_date, id')
  const taken = new Set(
    rows
      .map((row) => (row.portal_passcode ?? '').trim().toUpperCase())
      .filter(Boolean),
  )
  const today = torontoToday()
  const portals = []
  for (const row of rows) {
    let passcode = (row.portal_passcode ?? '').trim().toUpperCase()
    if (!passcode) {
      passcode = unusedPasscode(taken)
      taken.add(passcode)
      await query('UPDATE bookings SET portal_passcode = $1 WHERE id = $2', [
        passcode,
        row.id,
      ])
    }
    const planning = parsePlanning(row.planning, planningSeed(row)).planning
    const progress = overallProgress(planning, master)
    portals.push({
      slug: row.slug,
      partnerOne: row.partner_one,
      partnerTwo: row.partner_two,
      eventDate: row.event_date,
      sample: flag(row.sample),
      status: row.status,
      passcode,
      percent: progress.percent,
      answered: progress.answered,
      total: progress.total,
      locked: isPlanLocked(planning, today),
    })
  }
  portals.sort(
    (left, right) =>
      Number(left.sample) - Number(right.sample) ||
      left.eventDate.localeCompare(right.eventDate),
  )
  return { portals, drafts: masterDrafts(master), master }
}

export async function saveCouplePasscode(
  slugValue: string,
  code: string,
): Promise<string> {
  await ensurePortalColumns()
  const passcode = code.trim().toUpperCase()
  if (!/^[A-Z0-9]{4,12}$/.test(passcode)) {
    throw new Error('Use 4 to 12 letters or numbers.')
  }
  const rows = await query<{ id: number }>(
    'SELECT id FROM bookings WHERE slug = $1',
    [slugValue],
  )
  const row = rows.at(0)
  if (!row) throw new Error('That page was not found.')
  const clash = await query<{ id: number }>(
    'SELECT id FROM bookings WHERE upper(portal_passcode) = $1 AND id <> $2',
    [passcode, row.id],
  )
  if (clash.length > 0) throw new Error('That passcode is already in use.')
  await query('UPDATE bookings SET portal_passcode = $1 WHERE id = $2', [
    passcode,
    row.id,
  ])
  return passcode
}

export async function coupleByPasscode(code: string): Promise<string | null> {
  await ensurePortalColumns()
  const passcode = code.trim().toUpperCase()
  if (!/^[A-Z0-9]{4,12}$/.test(passcode)) return null
  const rows = await query<{ slug: string }>(
    'SELECT slug FROM bookings WHERE upper(portal_passcode) = $1',
    [passcode],
  )
  return rows.at(0)?.slug ?? null
}

function shareEnabled(value: unknown): boolean {
  return value === true || value === 1 || value === '1'
}

export async function readCoupleShare(
  slugValue: string,
): Promise<{ token: string; on: boolean }> {
  await ensurePortalColumns()
  const rows = await query<{
    portal_share?: string
    portal_share_on?: unknown
  }>('SELECT portal_share, portal_share_on FROM bookings WHERE slug = $1', [
    slugValue,
  ])
  const row = rows.at(0)
  if (!row) return { token: '', on: false }
  return {
    token: (row.portal_share ?? '').trim(),
    on: shareEnabled(row.portal_share_on),
  }
}

export async function enableCoupleShare(slugValue: string): Promise<string> {
  await ensurePortalColumns()
  const rows = await query<{ id: number; portal_share?: string }>(
    'SELECT id, portal_share FROM bookings WHERE slug = $1',
    [slugValue],
  )
  const row = rows.at(0)
  if (!row) throw new Error('That page was not found.')
  let token = (row.portal_share ?? '').trim()
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(token)) {
    token = randomBytes(24).toString('base64url')
  }
  await query(
    'UPDATE bookings SET portal_share = $1, portal_share_on = 1 WHERE id = $2',
    [token, row.id],
  )
  return token
}

export async function disableCoupleShare(slugValue: string): Promise<void> {
  await ensurePortalColumns()
  await query('UPDATE bookings SET portal_share_on = 0 WHERE slug = $1', [
    slugValue,
  ])
}

export async function planByShareToken(token: string) {
  const clean = token.trim()
  if (!/^[A-Za-z0-9_-]{16,80}$/.test(clean)) return null
  await ensurePortalColumns()
  const rows = await query<
    BookingRow & { planning?: string; portal_share_on?: unknown }
  >('SELECT * FROM bookings WHERE portal_share = $1', [clean])
  const row = rows.at(0)
  if (!row || !shareEnabled(row.portal_share_on)) return null
  const view = await present(toView(row, await invoiceFor(row.id)))
  const planning = parsePlanning(row.planning, planningSeed(row))
  return {
    partnerOne: view.partnerOne,
    partnerTwo: view.partnerTwo,
    eventDate: view.eventDate,
    packageName: view.packageName,
    venueName: view.venueName,
    planning: planning.planning,
    today: torontoToday(),
    master: await readPortalMaster(),
  }
}

export async function couplePortalForDesk(slugValue: string) {
  const page = await coupleBySlug(slugValue)
  if (!page) return null
  await ensurePortalColumns()
  const rows = await query<{ portal_passcode?: string }>(
    'SELECT portal_passcode FROM bookings WHERE slug = $1',
    [slugValue],
  )
  const master = await readPortalMaster()
  const today = torontoToday()
  return {
    ...page,
    slug: slugValue,
    passcode: (rows.at(0)?.portal_passcode ?? '').trim().toUpperCase(),
    master,
    today,
    locked: isPlanLocked(page.planning, today),
  }
}

export async function saveDeskPlanning(
  slugValue: string,
  value: unknown,
): Promise<Planning> {
  await ensurePlanningColumn()
  const rows = await query<BookingRow & { planning?: string }>(
    'SELECT * FROM bookings WHERE slug = $1',
    [slugValue],
  )
  const row = rows.at(0)
  if (!row) throw new Error('That page was not found.')
  const existing = parsePlanning(row.planning, planningSeed(row)).planning
  const planning = mergeCoupleSave(
    existing,
    planningFromUnknown(value, planningSeed(row)),
  )
  await query('UPDATE bookings SET planning = $1 WHERE id = $2', [
    JSON.stringify(planning),
    row.id,
  ])
  return planning
}

export async function lockCouplePlan(slugValue: string): Promise<Planning> {
  await ensurePlanningColumn()
  const rows = await query<BookingRow & { planning?: string }>(
    'SELECT * FROM bookings WHERE slug = $1',
    [slugValue],
  )
  const row = rows.at(0)
  if (!row) throw new Error('That page was not found.')
  const planning = {
    ...parsePlanning(row.planning, planningSeed(row)).planning,
    planLocked: true,
  }
  await query('UPDATE bookings SET planning = $1 WHERE id = $2', [
    JSON.stringify(planning),
    row.id,
  ])
  return planning
}

function clipPortal(value: string, max: number): string {
  return value.trim().slice(0, max)
}

export async function invoiceBySlug(slugValue: string) {
  const invoices = await query<InvoiceRow>(
    'SELECT * FROM invoices WHERE slug = $1',
    [slugValue],
  )
  const invoice = invoices.at(0)
  if (!invoice) return null
  const row = await bookingRow(invoice.booking_id)
  const view = toView(row, invoice)
  await ensurePaymentColumns()
  const hst = await query<{ total: unknown }>(
    'SELECT COALESCE(SUM(hst_cents), 0) AS total FROM payments WHERE invoice_id = $1 AND cents > 0',
    [invoice.id],
  )
  return {
    cardHstCents: Math.max(0, Number(hst.at(0)?.total ?? 0) || 0),
    partnerOne: view.partnerOne,
    partnerTwo: view.partnerTwo,
    eventDate: view.eventDate,
    bookingSlug: view.slug,
    sample: view.sample,
    packageName: view.packageName,
    venueName: view.venueName,
    venueTwoName: view.venueTwoName,
    uplights: view.uplights,
    depositDue: view.holdLastDay,
    status: view.invoice?.status ?? 'draft',
    totalCents: view.invoice?.totalCents ?? 0,
    depositCents: view.invoice?.depositCents ?? 0,
    discountCents: view.discountCents,
    receivedCents: view.invoice?.receivedCents ?? 0,
    balanceCents: view.invoice?.balanceCents ?? 0,
  }
}

export async function countedTotal(): Promise<number> {
  return countedCents(await states())
}

// --- card payments (Stripe) -------------------------------------------------

/** What a card payment needs to know about an invoice, by its link. */
export async function cardContextBySlug(slugValue: string) {
  const invoices = await query<InvoiceRow>(
    'SELECT * FROM invoices WHERE slug = $1',
    [slugValue],
  )
  const invoice = invoices.at(0)
  if (!invoice) return null
  const view = toView(await bookingRow(invoice.booking_id), invoice)
  return {
    bookingId: view.id,
    invoiceSlug: invoice.slug,
    packageId: view.packageId,
    packageName: view.packageName,
    email: view.email,
    couple: `${view.partnerOne} and ${view.partnerTwo}`,
    sample: view.sample,
    invoice: {
      status: view.invoice?.status ?? 'draft',
      totalCents: view.invoice?.totalCents ?? 0,
      depositCents: view.invoice?.depositCents ?? 0,
      receivedCents: view.invoice?.receivedCents ?? 0,
      balanceCents: view.invoice?.balanceCents ?? 0,
    },
  }
}

const SITE_SETTINGS = `CREATE TABLE IF NOT EXISTS site_settings (
  key text PRIMARY KEY,
  value text NOT NULL
)`

export async function readSiteSetting(key: string): Promise<string> {
  await query(SITE_SETTINGS)
  const rows = await query<{ value: string }>(
    'SELECT value FROM site_settings WHERE key = $1',
    [key],
  )
  return rows.at(0)?.value ?? ''
}

export async function writeSiteSetting(key: string, value: string) {
  await query(SITE_SETTINGS)
  await query(
    `INSERT INTO site_settings (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    [key, value],
  )
}

const STRIPE_PAYMENTS = `CREATE TABLE IF NOT EXISTS stripe_payments (
  session_id text PRIMARY KEY,
  booking_id integer NOT NULL,
  payment_id text NOT NULL DEFAULT '',
  kind text NOT NULL DEFAULT '',
  base_cents integer NOT NULL DEFAULT 0,
  hst_cents integer NOT NULL DEFAULT 0,
  live integer NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'recording',
  detail text NOT NULL DEFAULT '',
  recorded_at text NOT NULL DEFAULT ''
)`

/**
 * Takes the one slot for this Checkout session. False when the session was
 * already recorded (or is being recorded), so a payment never lands twice.
 */
export async function claimStripeSession(input: {
  sessionId: string
  bookingId: number
  paymentId: string
  kind: string
  baseCents: number
  hstCents: number
  live: boolean
}): Promise<boolean> {
  await query(STRIPE_PAYMENTS)
  const rows = await query<{ session_id: string }>(
    `INSERT INTO stripe_payments
       (session_id, booking_id, payment_id, kind, base_cents, hst_cents, live, status, recorded_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7, 'recording', $8)
     ON CONFLICT (session_id) DO NOTHING
     RETURNING session_id`,
    [
      input.sessionId,
      input.bookingId,
      input.paymentId,
      input.kind,
      input.baseCents,
      input.hstCents,
      input.live ? 1 : 0,
      new Date().toISOString(),
    ],
  )
  return rows.length > 0
}

export async function finishStripeSession(
  sessionId: string,
  status: 'recorded' | 'needs-attention',
  detail = '',
) {
  await query(
    'UPDATE stripe_payments SET status = $1, detail = $2 WHERE session_id = $3',
    [status, detail.slice(0, 500), sessionId],
  )
}

/** Lets Stripe's retry record a session whose first attempt failed. */
export async function releaseStripeSession(sessionId: string) {
  await query('DELETE FROM stripe_payments WHERE session_id = $1', [sessionId])
}

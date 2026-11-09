import { SECOND_VENUE_CENTS, UPLIGHT_CENTS } from '../piper/rules.ts'

export type InvoiceLineInput = {
  packageId: string
  packageName: string
  nonWedding: boolean
  eventType: string
  lockedTotal: boolean
  withStag: boolean
  totalCents: number
  discountCents: number
  uplights: number
  venueTwoName: string
  travelFeeCents: number
  distanceFeeCents: number
}

/**
 * The priced lines on an invoice, before any discount. They always add up to
 * the total plus the discount: the package line carries whatever the extras
 * do not, so an agreed or older price never shows a wrong sum.
 */
export function invoiceLines(input: InvoiceLineInput): [string, number][] {
  const before = input.totalCents + Math.max(0, input.discountCents)
  if (input.nonWedding) {
    const distance = Math.max(0, input.distanceFeeCents)
    const lines: [string, number][] = [[input.eventType || input.packageName, before - distance]]
    if (distance > 0) lines.push(['Distance fee', distance])
    return lines
  }
  if (input.packageId === 'custom' || input.lockedTotal) {
    return [[input.packageId === 'custom' ? 'Agreed price' : input.packageName, before]]
  }
  const extras: [string, number][] = []
  if (input.uplights > 0) extras.push([`Wired uplights × ${input.uplights}`, input.uplights * UPLIGHT_CENTS])
  if (input.venueTwoName.trim()) extras.push(['Second venue setup', SECOND_VENUE_CENTS])
  if (input.travelFeeCents > 0) extras.push(['Travel', input.travelFeeCents])
  const packageCents = before - extras.reduce((sum, [, cents]) => sum + cents, 0)
  if (packageCents < 0) return [[input.packageName, before]]
  const name = input.withStag ? `${input.packageName} with a stag and doe` : input.packageName
  return [[name, packageCents], ...extras]
}

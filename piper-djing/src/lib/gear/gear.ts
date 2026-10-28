/**
 * Piper's gear list: a private Desk record of equipment, serial numbers and
 * replacement values. Nothing here is ever shown on a public page.
 */

export type GearItem = {
  id: number
  item: string
  serial: string
  /** YYYY-MM-DD, YYYY-MM, or '' when unknown. */
  purchased: string
  /** Replacement value in whole cents, or null when not priced yet. */
  valueCents: number | null
  notes: string
}

export type GearDraft = {
  item: string
  serial: string
  purchased: string
  /** Dollars as typed, e.g. "1,060" or "" for not priced. */
  value: string
  notes: string
}

/** Only priced items count toward the total. */
export function gearTotalCents(items: { valueCents: number | null }[]): number {
  return items.reduce((sum, item) => sum + (item.valueCents ?? 0), 0)
}

export function gearPurchased(value: string): string {
  const raw = value.trim()
  if (!raw) return ''
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(raw)
  if (!match) throw new Error('Enter the purchase date as YYYY-MM or YYYY-MM-DD, or leave it blank.')
  const month = Number(match[2])
  const day = match[3] ? Number(match[3]) : 1
  if (month < 1 || month > 12 || day < 1 || day > 31) {
    throw new Error('That purchase date is not a real date.')
  }
  return raw
}

export function gearValueCents(value: string): number | null {
  const raw = value.trim().replace(/[$,\s]/g, '')
  if (!raw) return null
  if (!/^\d+(\.\d{1,2})?$/.test(raw)) {
    throw new Error('Enter the replacement value in dollars, like 1060 or 1060.50, or leave it blank.')
  }
  const cents = Math.round(Number(raw) * 100)
  if (cents > 100_000_000) throw new Error('That replacement value is too large.')
  return cents
}

export function gearText(value: string, max: number, label: string, required = false): string {
  const text = value.trim().replace(/\s+/g, ' ').slice(0, max)
  if (required && !text) throw new Error(`${label} is required.`)
  return text
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** "2026-10" → "Oct 2026", "2026-10-27" → "Oct 27, 2026". */
export function gearDateLabel(value: string): string {
  const match = /^(\d{4})-(\d{2})(?:-(\d{2}))?$/.exec(value)
  if (!match) return value
  const month = MONTHS[Number(match[2]) - 1] ?? match[2]
  return match[3] ? `${month} ${Number(match[3])}, ${match[1]}` : `${month} ${match[1]}`
}

export function gearDollars(cents: number): string {
  const dollars = cents / 100
  return `$${dollars.toLocaleString('en-CA', {
    minimumFractionDigits: cents % 100 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  })}`
}

/** The starting list (Oct 27–28, 2026). Martin edits it from the Desk. */
export const STARTING_GEAR: Omit<GearItem, 'id'>[] = [
  { item: 'Phenyx Pro PTI-2-2H Intelligent Wireless Microphone System (receiver unit)', serial: 'PTI20426A0089', purchased: '2026-10', valueCents: 32300, notes: 'Delivered Oct 27, 2026' },
  { item: 'Behringer XR18 X AIR 18-Channel 12-Bus Digital Mixer', serial: '0101G0A0605AAD', purchased: '', valueCents: 106000, notes: 'Paid $650; value shown is replacement' },
  { item: 'Alto Professional TS315 2000-Watt 15" 2-Way Powered Loudspeaker', serial: 'UT1809117721835', purchased: '', valueCents: 47900, notes: '' },
  { item: 'Alto Professional TS315 2000-Watt 15" 2-Way Powered Loudspeaker', serial: 'UT2004117764904', purchased: '', valueCents: 47900, notes: '' },
  { item: 'HK Audio Polar 10', serial: 'N01-2319-70086091', purchased: '', valueCents: 110000, notes: '' },
  { item: 'Chauvet DJ GigBAR 2', serial: '10051204-0620046209', purchased: '', valueCents: 92000, notes: '' },
  { item: 'Alto Professional TS108C 600-Watt Portable Columnar Array Loudspeaker', serial: 'V12503123600054', purchased: '', valueCents: 59900, notes: '' },
  { item: 'HK Audio Polar 10 MK2', serial: 'Unknown', purchased: '', valueCents: 144900, notes: 'Out for warranty repair at Long & McQuade; loaner covers gigs' },
  { item: 'Phenyx Pro PTU-71-2H Dual UHF Wireless Microphone System With Auto-Scan', serial: 'Unknown', purchased: '', valueCents: 21100, notes: '' },
  { item: 'Hercules DJControl Inpulse 500', serial: 'Unknown', purchased: '', valueCents: 49900, notes: '' },
  { item: 'Samsung Galaxy Tab A11+ (SM-X230)', serial: 'R5GL40MFX8N', purchased: '', valueCents: 25000, notes: '' },
  { item: 'Samsung NP750XGK Laptop', serial: 'KYS299YY40001YL', purchased: '', valueCents: 110000, notes: 'Variant NP750XGK-KG3CA, manufactured 04.2025' },
  { item: 'HP EliteBook 840 G1', serial: '5CG5191LCC', purchased: '', valueCents: 19000, notes: 'Refurbished' },
  { item: 'AmazonBasics XLR Male to Female Microphone Cable, 25 ft, Black (x7)', serial: 'n/a', purchased: '', valueCents: null, notes: 'Ordered Jun 2026 (x2), Sep 2025 (x2), Mar 2025 (x3); verify on-hand count' },
  { item: 'AmazonBasics XLR Male to Female Microphone Cable, 50 ft, Black (x2)', serial: 'n/a', purchased: '2023-05', valueCents: null, notes: '' },
  { item: 'Getaria 3.3 ft Male XLR to 1/4" TRS Jack Lead, balanced (x1)', serial: 'n/a', purchased: '2025-09', valueCents: null, notes: '' },
  { item: 'Getaria 6.6 ft XLR Male to 3.5mm TRS Jack Cable (x1)', serial: 'n/a', purchased: '2024-06', valueCents: null, notes: '' },
  { item: 'Getaria 6.6 ft Male XLR to 1/4" TRS Jack Lead, balanced (x1)', serial: 'n/a', purchased: '2024-06', valueCents: null, notes: '' },
  { item: 'CHUNGHOP XLR Female to 1/4" TRS Stereo Jack Adapter (x1)', serial: 'n/a', purchased: '2022-12', valueCents: null, notes: '' },
  { item: 'DEWENWILS Outdoor Extension Cord, 1-to-3 Splitter, 40 ft (x2)', serial: 'n/a', purchased: '', valueCents: null, notes: 'Ordered Jul (year not shown)' },
  { item: 'HUANCHAIN Indoor/Outdoor Black Extension Cord, 50 ft, 16/3, 2-pack (x2 cords)', serial: 'n/a', purchased: '', valueCents: null, notes: 'Ordered Jul (year not shown)' },
  { item: 'HUANCHAIN Indoor/Outdoor Black Extension Cord, 25 ft, waterproof (x6)', serial: 'n/a', purchased: '', valueCents: null, notes: 'Ordered Jun 2026 (x2), Sep 2025 (x4); verify on-hand count' },
]

/**
 * Custom invoice lines Piper adds to a booking: a label and an amount, which
 * can be negative for a labelled discount or credit. They are added to the
 * total in the order set, before the plain Discount field comes off.
 */

export type LineItem = { label: string; cents: number }

export const MAX_LINE_ITEMS = 20
export const MAX_LINE_LABEL = 80

/** Reads stored or sent lines; anything malformed is dropped, never thrown. */
export function parseLineItems(raw: unknown): LineItem[] {
  let value = raw
  if (typeof value === 'string') {
    try {
      value = JSON.parse(value || '[]')
    } catch {
      return []
    }
  }
  if (!Array.isArray(value)) return []
  return value
    .map((item) => ({
      label: typeof item?.label === 'string' ? item.label.trim() : '',
      cents: typeof item?.cents === 'number' ? item.cents : Number.NaN,
    }))
    .filter((item) => item.label && Number.isInteger(item.cents))
}

/** Checks lines a person typed: each needs a label and a whole-cent, non-zero amount. */
export function cleanLineItems(items: unknown): LineItem[] {
  if (items === undefined || items === null) return []
  if (!Array.isArray(items)) throw new Error('The line items did not read.')
  if (items.length > MAX_LINE_ITEMS) throw new Error(`Up to ${MAX_LINE_ITEMS} line items.`)
  return items.map((item, index) => {
    const label = typeof item?.label === 'string' ? item.label.trim().replace(/\s+/g, ' ') : ''
    const cents = typeof item?.cents === 'number' ? item.cents : Number.NaN
    if (!label) throw new Error(`Line ${index + 1} needs a label.`)
    if (label.length > MAX_LINE_LABEL) throw new Error(`Line ${index + 1}: keep the label under ${MAX_LINE_LABEL} characters.`)
    if (!Number.isInteger(cents) || cents === 0) throw new Error(`Line ${index + 1} needs an amount.`)
    return { label, cents }
  })
}

export function lineItemsCents(items: readonly LineItem[] | undefined): number {
  return (items ?? []).reduce((sum, item) => sum + item.cents, 0)
}

export function sameLineItems(a: readonly LineItem[], b: readonly LineItem[]): boolean {
  return a.length === b.length && a.every((item, index) => item.label === b[index]?.label && item.cents === b[index]?.cents)
}

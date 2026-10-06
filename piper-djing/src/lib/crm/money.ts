/** Whole cents, shown as Canadian dollars. Used on private pages. */
export function cad(cents: number): string {
  const sign = cents < 0 ? '-' : ''
  const abs = Math.abs(cents)
  const dollars = Math.floor(abs / 100)
  const rest = String(abs % 100).padStart(2, '0')
  return `${sign}$${dollars.toLocaleString('en-CA')}.${rest}`
}

export function dollarsToCents(value: string): number {
  const trimmed = value.trim()
  if (!/^\d+(\.\d{1,2})?$/.test(trimmed)) {
    throw new Error('Enter dollars and cents, such as 500.00.')
  }
  const [dollars, fraction = ''] = trimmed.split('.')
  return Number(dollars) * 100 + Number(fraction.padEnd(2, '0'))
}

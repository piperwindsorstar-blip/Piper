import type { PackageId } from './defaults.ts'

export type PackageOffer = {
  id: PackageId
  name: string
  detail: string
  cents: number
}

/** Public price line. Ceremony stays “paid in full”. */
export function publicPackagePrice(id: PackageId, cents: number): string {
  const dollars = Math.round(cents / 100)
  const amount = `$${dollars.toLocaleString('en-CA')}`
  return id === 'ceremony' ? `${amount} paid in full` : amount
}

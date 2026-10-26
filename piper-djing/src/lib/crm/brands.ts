/** Brands Piper has worked with: the scrolling strip and the desk list. */

export type PublicBrand = {
  id: number
  name: string
  /** The brand's website, or null when the logo is not a link. */
  href: string | null
  logo: string
}

export type DeskBrand = PublicBrand & { shown: boolean }

export function brandLogoUrl(id: number, version: number): string {
  return `/brand-logo/${id}?v=${version}`
}

/**
 * Enough copies of the brands to fill one half of the strip, so a short list
 * still scrolls as one seamless row. The first copy is the real list.
 */
export function stripCopies(count: number, minimum = 12): number {
  if (count <= 0) return 0
  return Math.max(1, Math.ceil(minimum / count))
}

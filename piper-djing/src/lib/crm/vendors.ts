/**
 * Vendors Piper loves working with: shared rules for the public page and the
 * desk. Nothing here talks to the Book.
 */

/** The categories a fresh site starts with. Piper edits them in the desk. */
export const STARTING_VENDOR_CATEGORIES = [
  'Venues',
  'Photographers',
  'Videographers',
  'Planners & Coordinators',
  'Florists',
  'Hair & Makeup',
  'Officiants',
  'Cakes & Desserts',
  'Rentals & Decor',
] as const

export const VENDOR_LOGO_MIMES = ['image/png', 'image/jpeg', 'image/webp'] as const

/** Base64 length of the largest logo kept (about 200 KB). */
export const VENDOR_LOGO_MAX_BASE64 = 280_000

export type PublicVendor = {
  id: number
  name: string
  href: string
  /** The logo's address on this site, or null for a text card. */
  logo: string | null
}

export type PublicVendorGroup = {
  id: number
  name: string
  vendors: PublicVendor[]
}

export type DeskVendor = PublicVendor & {
  categoryId: number
  shown: boolean
}

export type DeskVendorCategory = {
  id: number
  name: string
  vendors: DeskVendor[]
}

/** A vendor's website: a full https:// address, nothing else. */
export function vendorWebsite(value: string): string {
  const raw = value.trim()
  if (!raw) throw new Error('A website is required.')
  if (!/^https:\/\//i.test(raw)) {
    throw new Error('The website must start with https://')
  }
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw new Error('Enter a full website address, starting with https://')
  }
  if (url.protocol !== 'https:' || !url.hostname.includes('.')) {
    throw new Error('Enter a full website address, starting with https://')
  }
  if (raw.length > 300) throw new Error('That website address is too long.')
  return url.toString()
}

export function vendorName(value: string, label = 'A name'): string {
  const name = value.trim().replace(/\s+/g, ' ').slice(0, 80)
  if (!name) throw new Error(`${label} is required.`)
  return name
}

/** A logo upload as `data:image/...;base64,...`, split and checked. */
export function vendorLogoData(value: string): { mime: string; logo: string } {
  const match = /^data:(image\/(?:png|jpeg|webp));base64,([A-Za-z0-9+/=\s]+)$/.exec(
    value.trim(),
  )
  if (!match) throw new Error('Use a PNG, JPEG, or WebP logo.')
  const mime = match[1] ?? ''
  const logo = (match[2] ?? '').replace(/\s/g, '')
  if (!logo) throw new Error('Use a PNG, JPEG, or WebP logo.')
  if (logo.length > VENDOR_LOGO_MAX_BASE64) {
    throw new Error('That logo is still too large after shrinking it. Try a smaller image.')
  }
  return { mime, logo }
}

/** Where a vendor's logo is served; the version makes a new upload show at once. */
export function vendorLogoUrl(id: number, version: number): string {
  return `/vendor-logo/${id}?v=${version}`
}

/** Public groups: categories in order, only visible vendors, empty ones left out. */
export function publicVendorGroups(
  categories: { id: number; name: string }[],
  vendors: (PublicVendor & { categoryId: number })[],
): PublicVendorGroup[] {
  return categories
    .map((category) => ({
      id: category.id,
      name: category.name,
      vendors: vendors
        .filter((vendor) => vendor.categoryId === category.id)
        .map(({ id, name, href, logo }) => ({ id, name, href, logo })),
    }))
    .filter((group) => group.vendors.length > 0)
}

/** The order after moving one item up or down; unchanged at either end. */
export function moved<T>(items: T[], index: number, direction: 'up' | 'down'): T[] {
  const target = direction === 'up' ? index - 1 : index + 1
  if (index < 0 || index >= items.length || target < 0 || target >= items.length) {
    return items
  }
  const next = [...items]
  const [item] = next.splice(index, 1)
  next.splice(target, 0, item as T)
  return next
}

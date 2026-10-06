/** The old host must send people to the same path on the custom domain. */
export const LEGACY_HOST = 'piperp-wedding-dj.grok.me'

const PUBLIC_ORIGIN = 'https://piperpweddingdj.services'

export function legacyLocation(
  hostname: string,
  pathname: string,
  search: string,
): string | null {
  if (hostname !== LEGACY_HOST) return null
  return `${PUBLIC_ORIGIN}${pathname}${search}`
}

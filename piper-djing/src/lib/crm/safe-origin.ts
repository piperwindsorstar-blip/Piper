import site from '../og/site.json'

/**
 * The public site origin. Canonical links, robots, and the sitemap all read
 * this so a preview host cannot become the address search engines keep.
 */
export const PUBLIC_SITE = (
  (typeof process !== 'undefined' && process.env.PUBLIC_SITE) ||
  site.url
).replace(/\/$/, '')

export function publicUrl(path: string): string {
  if (path === '/') return `${PUBLIC_SITE}/`
  return `${PUBLIC_SITE}${path.startsWith('/') ? path : `/${path}`}`
}

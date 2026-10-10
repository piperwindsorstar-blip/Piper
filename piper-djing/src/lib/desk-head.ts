import { privateHead } from './seo.ts'

export const DESK_FONTS =
  'https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,800&family=DM+Sans:wght@400;500;700&family=JetBrains+Mono:wght@400;500&display=swap'

export function deskHead(title: string) {
  return {
    ...privateHead(title),
    links: [{ rel: 'stylesheet' as const, href: DESK_FONTS }],
  }
}

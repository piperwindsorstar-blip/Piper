import { privateHead } from './seo.ts'

/** A desk page's head. The typefaces come from the root document. */
export function deskHead(title: string) {
  return privateHead(title)
}

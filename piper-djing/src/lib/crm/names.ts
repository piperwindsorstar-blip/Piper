/**
 * Two names joined ("Mark and Mya"), or one name alone when the other is
 * blank, so a one-person booking never reads "Jordan Biggs and ".
 */
export function pairNames(one: string | null | undefined, two: string | null | undefined, joiner = 'and'): string {
  return [one, two]
    .map((name) => (name ?? '').trim())
    .filter(Boolean)
    .join(` ${joiner} `)
}

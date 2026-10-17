/**
 * The ?q= a portal page opens on. Kept apart from questions.ts: a route's
 * validateSearch is part of the code every page loads, and importing the
 * question list here would ship it to every visitor.
 */
export function questionSearch(search: Record<string, unknown>): {
  q?: string
} {
  if (typeof search.q !== 'string') return {}
  const q = search.q.trim()
  if (!q || q.length > 80) return {}
  return { q }
}

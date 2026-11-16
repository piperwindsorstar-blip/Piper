const TTL_MS = 5 * 60 * 1000
const CACHE_URL = 'https://piperpweddingdj.services/__cache/public-site'

type Snapshot = { at: number; body: string }

let memory: Snapshot | null = null

function cacheStorage(): Cache | null {
  const storage = (globalThis as { caches?: { default?: Cache } }).caches
  return storage?.default ?? null
}

function fresh(): string | null {
  if (!memory) return null
  if (Date.now() - memory.at >= TTL_MS) return null
  return memory.body
}

function remember(value: unknown): void {
  memory = { at: Date.now(), body: JSON.stringify(value) }
}

export function readPublicMemory<T>(): T | null {
  const body = fresh()
  if (body == null) return null
  return JSON.parse(body) as T
}

export async function readPublicEdge<T>(): Promise<T | null> {
  const cache = cacheStorage()
  if (!cache) return null
  const hit = await cache.match(CACHE_URL)
  if (!hit) return null
  const value = (await hit.json()) as T
  remember(value)
  return value
}

export async function writePublicEdge(value: unknown): Promise<void> {
  remember(value)
  const cache = cacheStorage()
  if (!cache) return
  await cache.put(
    CACHE_URL,
    new Response(JSON.stringify(value), {
      headers: { 'cache-control': 'public, max-age=300' },
    }),
  )
}

/** Drop the public snapshot after a review or package change. */
export async function forgetPublicSite(): Promise<void> {
  memory = null
  const cache = cacheStorage()
  if (!cache) return
  await cache.delete(CACHE_URL)
}

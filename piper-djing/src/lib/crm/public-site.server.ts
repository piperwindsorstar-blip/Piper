import { PACKAGE_BUTTON_COPY } from './defaults.ts'
import {
  readPublicEdge,
  readPublicMemory,
  writePublicEdge,
} from './public-memory.ts'
import { PACKAGE_CENTS } from '../piper/rules.ts'
import { loadPublicCatalog } from './store.server.ts'
import type { PublicCatalog } from './store.server.ts'

export type { PublicCatalog }

/** A normal public page reads this snapshot. A warm copy makes no Book call. */
export async function readPublicSite(): Promise<PublicCatalog> {
  const memory = readPublicMemory<PublicCatalog>()
  if (memory) return memory
  const edge = await readPublicEdge<PublicCatalog>()
  if (edge) return edge
  let site: PublicCatalog
  try {
    site = await loadPublicCatalog()
  } catch {
    site = staticCatalog()
  }
  await writePublicEdge(site)
  return site
}

function staticCatalog(): PublicCatalog {
  return {
    reviews: [],
    partners: [],
    packages: PACKAGE_BUTTON_COPY.map((item) => ({
      id: item.id,
      name: item.name,
      detail: item.detail,
      cents: PACKAGE_CENTS[item.id],
    })),
    reviewDisplay: { home: 'both', weddings: 'both' },
  }
}

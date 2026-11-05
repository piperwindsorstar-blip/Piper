export type SavedVenue = {
  id: number
  name: string
  street: string
}

export function matchingVenue(
  venues: SavedVenue[],
  name: string,
): SavedVenue | null {
  const key = name.trim().toLowerCase()
  if (!key) return null
  return venues.find((venue) => venue.name.trim().toLowerCase() === key) ?? null
}

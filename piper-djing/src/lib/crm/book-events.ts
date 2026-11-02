/**
 * The event types on /book. Wedding keeps the wedding form exactly as it was;
 * every other type gets the custom-quote form.
 */
export const BOOK_EVENT_TYPES = [
  'Wedding',
  'Private',
  'Corporate',
  'Community & Charity',
  'Club night',
] as const

export type BookEventType = (typeof BOOK_EVENT_TYPES)[number]

/** Events that have always opened the wedding form. */
const WEDDING_EVENTS = new Set(['', 'Wedding', 'Stag and doe', 'Ceremony only', 'Anniversary'])

/** Date checker events that belong to one of the non-wedding types. */
const EVENT_TYPE_FOR: Record<string, BookEventType> = {
  Private: 'Private',
  Corporate: 'Corporate',
  'Community & Charity': 'Community & Charity',
  'Club night': 'Club night',
  'Birthday party': 'Private',
  'Christmas party': 'Corporate',
}

/**
 * Which form an `event` from the date checker opens. Wedding events open the
 * wedding form; anything else opens the custom-quote form, with its type
 * (unknown events, such as "Something else" typed by the visitor, are Private).
 */
export function bookEventType(event: string): BookEventType {
  const value = event.trim()
  if (WEDDING_EVENTS.has(value)) return 'Wedding'
  return EVENT_TYPE_FOR[value] ?? 'Private'
}

/**
 * What the inquiry records as the event: the type, plus the date checker's
 * own words when they say more ("Corporate · Christmas party").
 */
export function bookEventLabel(type: BookEventType, checked: string): string {
  const detail = checked.trim()
  if (!detail || detail === type || WEDDING_EVENTS.has(detail)) return type
  return `${type} · ${detail}`.slice(0, 80)
}

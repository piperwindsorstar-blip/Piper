export const EXTERNAL_KINDS = ['wedding', 'event'] as const

export type ExternalKind = (typeof EXTERNAL_KINDS)[number]

export type ExternalDate = {
  id: number
  eventDate: string
  kind: ExternalKind
  company: string
  label: string
  partnerOne: string
  partnerTwo: string
  venueName: string
  venueStreet: string
  venueTwoName: string
  venueTwoStreet: string
  notes: string
  released: boolean
}

export function externalCouple(
  row: Pick<ExternalDate, 'partnerOne' | 'partnerTwo' | 'label'>,
): string {
  const names = [row.partnerOne, row.partnerTwo]
    .map((name) => name.trim())
    .filter(Boolean)
  if (names.length === 2) return `${names[0]} and ${names[1]}`
  if (names.length === 1) return names[0] ?? ''
  return row.label.trim()
}

export function externalVenues(
  row: Pick<
    ExternalDate,
    'venueName' | 'venueStreet' | 'venueTwoName' | 'venueTwoStreet'
  >,
): string[] {
  const line = (name: string, street: string) =>
    [name.trim(), street.trim()].filter(Boolean).join(', ')
  return [
    line(row.venueName, row.venueStreet),
    line(row.venueTwoName, row.venueTwoStreet),
  ].filter(Boolean)
}

export function externalKindLabel(kind: ExternalKind): string {
  return kind === 'wedding' ? 'Wedding' : 'Event'
}

export function asExternalKind(value: string): ExternalKind {
  if (value === 'wedding' || value === 'event') return value
  throw new Error('Choose a wedding or an event.')
}

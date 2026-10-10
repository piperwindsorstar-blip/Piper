export const EXTERNAL_KINDS = ['wedding', 'event'] as const

export type ExternalKind = (typeof EXTERNAL_KINDS)[number]

export type ExternalDate = {
  id: number
  eventDate: string
  kind: ExternalKind
  company: string
  label: string
  notes: string
  released: boolean
}

export function externalKindLabel(kind: ExternalKind): string {
  return kind === 'wedding' ? 'Wedding' : 'Event'
}

export function asExternalKind(value: string): ExternalKind {
  if (value === 'wedding' || value === 'event') return value
  throw new Error('Choose a wedding or an event.')
}

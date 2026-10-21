export type SavedLead = {
  id: number
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  eventDate: string | null
  packageId: string
  packageName: string
  withStag: boolean
  stagDate: string | null
  message: string
}

export type BotLead = {
  id: number
  name: string
  partnerOne: string
  partnerTwo: string
  email: string
  phone: string
  weddingDate: string | null
  venue: string
  streetAddress: string
  service: string
  packageName: string
  withStag: boolean
  stagDate: string | null
  guestCount: null
  source: string
  status: 'new'
  budgetCents: null
  message: string
  notes: string
}

export function isDeskLeadList(pathname: string, method: string): boolean {
  if (method !== 'GET') return false
  const bare =
    pathname.length > 1 && pathname.endsWith('/')
      ? pathname.slice(0, -1)
      : pathname
  return bare === '/api/bots/v1/leads'
}

export function toBotLead(lead: SavedLead): BotLead {
  const name = `${lead.partnerOne} and ${lead.partnerTwo}`
  return {
    id: lead.id,
    name,
    partnerOne: lead.partnerOne,
    partnerTwo: lead.partnerTwo,
    email: lead.email,
    phone: lead.phone,
    weddingDate: lead.eventDate,
    venue: '',
    streetAddress: '',
    service: lead.packageId,
    packageName: lead.packageName,
    withStag: lead.withStag,
    stagDate: lead.stagDate,
    guestCount: null,
    source: 'book',
    status: 'new',
    budgetCents: null,
    message: lead.message,
    notes: lead.message,
  }
}

export function selectLeads(
  leads: BotLead[],
  search: URLSearchParams,
): BotLead[] {
  const date = search.get('date')?.trim() ?? ''
  const query = search.get('q')?.trim().toLowerCase() ?? ''
  return leads.filter((lead) => {
    if (date && lead.weddingDate !== date && lead.stagDate !== date)
      return false
    if (!query) return true
    return [
      lead.name,
      lead.email,
      lead.phone,
      lead.message,
      lead.packageName,
      lead.service,
    ]
      .join('\n')
      .toLowerCase()
      .includes(query)
  })
}

export function legacyVerdict(
  status: number,
  contentType: string | null,
): 'yes' | 'no' | 'unknown' {
  if (status === 401 || status === 403) return 'no'
  if (status >= 200 && status < 300 && (contentType ?? '').includes('json'))
    return 'yes'
  return 'unknown'
}

import { botFromToken, listLeads } from '../crm/store.server.ts'
import { selectLeads, toBotLead } from './desk-leads.ts'

const DENIED = 'Send Authorization: Bearer and the token from join.'

export async function deskLeadsResponse(
  request: Request,
  checkLegacy: (
    token: string,
  ) => Promise<'yes' | 'no' | 'unknown'> = legacyAllows,
): Promise<Response> {
  const token = bearer(request)
  if (!token) return denied()
  const local = await botFromToken(token)
  if (!local) {
    const verdict = await checkLegacy(token)
    if (verdict === 'no') return denied()
    if (verdict !== 'yes') return unavailable()
  }
  const url = new URL(request.url)
  const leads = selectLeads(
    (await listLeads()).map((lead) => toBotLead(lead)),
    url.searchParams,
  )
  return json({ leads })
}

export async function legacyAllows(
  token: string,
): Promise<'yes' | 'no' | 'unknown'> {
  const verdict = await legacyRole(token)
  if (verdict === 'reader' || verdict === 'writer' || verdict === 'ceo')
    return 'yes'
  return verdict
}

/** A token that is not on this book is refused. The old site is not asked. */
export async function legacyRole(
  _token: string,
): Promise<'yes' | 'no' | 'unknown' | 'reader' | 'writer' | 'ceo'> {
  return 'no'
}

function bearer(request: Request): string {
  const header = request.headers.get('authorization') ?? ''
  return header.startsWith('Bearer ')
    ? header.slice('Bearer '.length).trim()
    : ''
}

function denied(): Response {
  return json({ error: DENIED }, 401)
}

function unavailable(): Response {
  return json({ error: 'The lead list could not be checked.' }, 503)
}

function json(body: unknown, status = 200): Response {
  return Response.json(body, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-piper-book': 'desk',
      'access-control-allow-origin': '*',
      'access-control-allow-headers':
        'authorization, content-type, idempotency-key',
      'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
    },
  })
}

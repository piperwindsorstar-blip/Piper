import { listPackageOffers } from '../crm/store.server.ts'
import { handleBot } from './handle.server.ts'
import { usageDocument } from './usage.ts'

const HEADERS = {
  'cache-control': 'no-store',
  'x-piper-book': 'desk',
  'access-control-allow-origin': '*',
  'access-control-allow-headers':
    'authorization, content-type, idempotency-key',
  'access-control-allow-methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
}

export async function deskUsageResponse(request: Request): Promise<Response> {
  if (request.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: HEADERS })
  }
  if (request.method === 'GET' || request.method === 'HEAD') {
    const body = JSON.stringify(usageDocument(await listPackageOffers()))
    return new Response(request.method === 'HEAD' ? null : body, {
      status: 200,
      headers: {
        ...HEADERS,
        'content-type': 'application/json; charset=utf-8',
      },
    })
  }
  if (request.method === 'POST') {
    const response = await handleBot(request)
    const headers = new Headers(response.headers)
    for (const [key, value] of Object.entries(HEADERS)) headers.set(key, value)
    return new Response(response.body, { status: response.status, headers })
  }
  return Response.json(
    { error: 'Use GET or POST.' },
    { status: 405, headers: HEADERS },
  )
}

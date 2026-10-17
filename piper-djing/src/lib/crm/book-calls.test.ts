import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { deskBotResponse } from '../bots/desk-rest.server.ts'
import { deskUsageResponse } from '../bots/usage.server.ts'
import { takeBookCalls } from '../db.server.ts'
import { forgetPublicSite } from './public-memory.ts'
import { readPublicSite } from './public-site.server.ts'
import { dateOpen, inviteBot } from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)
const root = resolve(dirname(fileURLToPath(import.meta.url)), '../../..')

describe('book calls', { skip: liveBook, concurrency: 1 }, () => {
  it('reads a public page once, then serves the copy', async () => {
    // A fresh server first sets up the reviews table, once. Warm that up so
    // this counts what every later cold read costs: one Book call.
    await readPublicSite()
    await forgetPublicSite()
    takeBookCalls()
    const first = await readPublicSite()
    assert.equal(takeBookCalls(), 1)
    assert.equal(first.packages.length, 4)
    assert.equal(first.packages[0]?.cents, 165000)
    takeBookCalls()
    const second = await readPublicSite()
    assert.equal(takeBookCalls(), 0)
    assert.equal(second.packages[0]?.cents, first.packages[0]?.cents)
  })

  it('reads the bot usage page in one call', async () => {
    takeBookCalls()
    const response = await deskUsageResponse(
      new Request('http://localhost/api/bots/v1'),
    )
    assert.equal(response.status, 200)
    assert.equal(takeBookCalls(), 1)
  })

  it('reads the package list for a bot in one call', async () => {
    const { token } = await inviteBot('Call counter', 'reader')
    takeBookCalls()
    const response = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/packages', {
        headers: { authorization: `Bearer ${token}` },
      }),
    )
    assert.equal(response.status, 200)
    assert.equal(takeBookCalls(), 1)
    const body = (await response.json()) as { packages: unknown[] }
    assert.equal(body.packages.length, 4)
  })

  it('checks one date in one call', async () => {
    takeBookCalls()
    assert.equal(await dateOpen('2028-09-01'), true)
    assert.equal(takeBookCalls(), 1)
    takeBookCalls()
    assert.equal(await dateOpen('2027-02-20'), false)
    assert.equal(takeBookCalls(), 0)
  })

  it('does not fetch the old host', () => {
    const files = [
      'src/start.ts',
      'src/lib/legacy-book.server.ts',
      'src/lib/legacy-host.ts',
      'src/lib/bots/desk-leads.server.ts',
      'src/lib/bots/desk-rest.server.ts',
      'src/lib/crm/store.server.ts',
      'src/lib/crm/public.functions.ts',
      'src/lib/crm/public-site.server.ts',
    ]
    const source = files
      .map((file) => readFileSync(resolve(root, file), 'utf8'))
      .join('\n')
    assert.doesNotMatch(source, /\bfetch\s*\(/)
    const host = readFileSync(resolve(root, 'src/lib/legacy-host.ts'), 'utf8')
    const rest = source.replace(host, '')
    assert.doesNotMatch(rest, /piperp-wedding-dj\.grok\.me/)
  })
})

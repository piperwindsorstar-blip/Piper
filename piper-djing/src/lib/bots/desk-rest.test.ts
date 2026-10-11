import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { inviteBot, listPackageOffers } from '../crm/store.server.ts'
import { deskBotResponse } from './desk-rest.server.ts'
import { deskBotTarget } from './desk-rest.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('desk bot paths', () => {
  it('serves the desk resources and leaves join on the old book', () => {
    assert.deepEqual(deskBotTarget('/api/bots/v1/leads'), {
      resource: 'leads',
      id: null,
    })
    assert.deepEqual(deskBotTarget('/api/bots/v1/leads/'), {
      resource: 'leads',
      id: null,
    })
    assert.deepEqual(deskBotTarget('/api/bots/v1/packages/full'), {
      resource: 'packages',
      id: 'full',
    })
    assert.equal(deskBotTarget('/api/bots/v1'), null)
    assert.equal(deskBotTarget('/api/bots/v1/join'), null)
    assert.equal(deskBotTarget('/api/bots/v1/glance'), null)
    assert.equal(deskBotTarget('/api/bots/v1/landing'), null)
    assert.equal(deskBotTarget('/api/bots/v1/forms/4/responses'), null)
  })
})

describe('desk bot edits', { skip: liveBook }, () => {
  it('lets a writer change a package and keeps a reader from writing', async () => {
    const reader = await inviteBot('Rest Reader', 'reader')
    const writer = await inviteBot('Rest Writer', 'writer')
    const denied = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/questions', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${reader.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ prompt: 'Reader question' }),
      }),
      async () => 'no',
    )
    assert.equal(denied.status, 403)

    const current = (await listPackageOffers()).find(
      (item) => item.id === 'stag',
    )
    assert.ok(current)
    const saved = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/packages/stag', {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${writer.token}`,
          'content-type': 'application/json',
          'idempotency-key': 'stag-price-once',
        },
        body: JSON.stringify({
          name: current.name,
          detail: current.detail,
          priceCents: 75000,
        }),
      }),
      async () => 'no',
    )
    assert.equal(saved.status, 200)
    const body = (await saved.json()) as { package: { cents: number } }
    assert.equal(body.package.cents, 75000)

    const repeat = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/packages/stag', {
        method: 'PATCH',
        headers: {
          authorization: `Bearer ${writer.token}`,
          'content-type': 'application/json',
          'idempotency-key': 'stag-price-once',
        },
        body: JSON.stringify({ priceCents: 80000 }),
      }),
      async () => 'no',
    )
    assert.equal(repeat.status, 200)
    const repeated = (await repeat.json()) as { package: { cents: number } }
    assert.equal(repeated.package.cents, 75000)
    assert.equal(
      (await listPackageOffers()).find((item) => item.id === 'stag')?.cents,
      75000,
    )
  })

  it('keeps a writer from changing invites', async () => {
    const writer = await inviteBot('Rest Writer Two', 'writer')
    const ceo = await inviteBot('Rest Ceo', 'ceo')
    const denied = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/bots', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${writer.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Extra', role: 'writer' }),
      }),
      async () => 'no',
    )
    assert.equal(denied.status, 403)
    const invited = await deskBotResponse(
      new Request('http://localhost/api/bots/v1/bots', {
        method: 'POST',
        headers: {
          authorization: `Bearer ${ceo.token}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({ name: 'Extra', role: 'reader' }),
      }),
      async () => 'no',
    )
    assert.equal(invited.status, 200)
    const token = ((await invited.json()) as { token?: string }).token
    assert.equal(typeof token, 'string')
    assert.ok(token && token.length > 10)
  })
})

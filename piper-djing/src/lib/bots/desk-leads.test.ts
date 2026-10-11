import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createInquiry } from '../crm/store.server.ts'
import type { SavedLead } from './desk-leads.ts'
import {
  isDeskLeadList,
  legacyVerdict,
  selectLeads,
  toBotLead,
} from './desk-leads.ts'
import { deskLeadsResponse } from './desk-leads.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

const saved: SavedLead = {
  id: 4,
  partnerOne: 'Casey',
  partnerTwo: 'Drew',
  email: 'casey@example.com',
  phone: '519-555-0100',
  eventDate: '2026-12-20',
  packageId: 'full',
  packageName: 'Full wedding day',
  withStag: true,
  stagDate: '2026-11-08',
  message: 'Outdoor ceremony',
}

describe('desk lead list', () => {
  it('answers only the lead list read', () => {
    assert.equal(isDeskLeadList('/api/bots/v1/leads', 'GET'), true)
    assert.equal(isDeskLeadList('/api/bots/v1/leads/', 'GET'), true)
    assert.equal(isDeskLeadList('/api/bots/v1/leads', 'POST'), false)
    assert.equal(isDeskLeadList('/api/bots/v1/leads/4', 'GET'), false)
    assert.equal(isDeskLeadList('/api/bots/v1/bookings', 'GET'), false)
  })

  it('keeps both names, the package, the stag date, and the note', () => {
    const lead = toBotLead(saved)
    assert.equal(lead.name, 'Casey and Drew')
    assert.equal(lead.partnerOne, 'Casey')
    assert.equal(lead.partnerTwo, 'Drew')
    assert.equal(lead.email, 'casey@example.com')
    assert.equal(lead.phone, '519-555-0100')
    assert.equal(lead.weddingDate, '2026-12-20')
    assert.equal(lead.service, 'full')
    assert.equal(lead.packageName, 'Full wedding day')
    assert.equal(lead.withStag, true)
    assert.equal(lead.stagDate, '2026-11-08')
    assert.equal(lead.message, 'Outdoor ceremony')
    assert.equal(lead.notes, 'Outdoor ceremony')
    assert.equal(lead.status, 'new')
  })

  it('filters by the wedding date or the note', () => {
    const leads = [toBotLead(saved)]
    assert.equal(
      selectLeads(leads, new URLSearchParams('date=2026-12-20')).length,
      1,
    )
    assert.equal(
      selectLeads(leads, new URLSearchParams('date=2026-11-08')).length,
      1,
    )
    assert.equal(
      selectLeads(leads, new URLSearchParams('date=2026-01-01')).length,
      0,
    )
    assert.equal(selectLeads(leads, new URLSearchParams('q=outdoor')).length, 1)
    assert.equal(selectLeads(leads, new URLSearchParams('q=missing')).length, 0)
  })

  it('reads a json glance as permission and a refusal as none', () => {
    assert.equal(legacyVerdict(200, 'application/json; charset=utf-8'), 'yes')
    assert.equal(legacyVerdict(401, 'application/json'), 'no')
    assert.equal(legacyVerdict(403, 'application/json'), 'no')
    assert.equal(legacyVerdict(200, 'text/html'), 'unknown')
    assert.equal(legacyVerdict(502, 'application/json'), 'unknown')
  })
})

describe('desk lead response', { skip: liveBook }, () => {
  it('returns the saved inquiry when the existing bot token is accepted', async () => {
    await createInquiry({
      partnerOne: 'Quinn',
      partnerTwo: 'Reese',
      email: 'quinn-bot-list@example.com',
      phone: '519-555-0142',
      eventDate: '2027-11-08',
      packageId: 'full',
      withStag: true,
      stagDate: '2027-10-18',
      message: 'Evening ceremony by the lake',
    })
    const response = await deskLeadsResponse(
      new Request('http://localhost/api/bots/v1/leads', {
        headers: { authorization: 'Bearer existing-bot' },
      }),
      async () => 'yes',
    )
    assert.equal(response.status, 200)
    assert.equal(response.headers.get('x-piper-book'), 'desk')
    const body = (await response.json()) as {
      leads: Array<Record<string, unknown>>
    }
    const lead = body.leads.find(
      (item) => item.email === 'quinn-bot-list@example.com',
    )
    assert.ok(lead)
    assert.equal(lead.name, 'Quinn and Reese')
    assert.equal(lead.partnerOne, 'Quinn')
    assert.equal(lead.partnerTwo, 'Reese')
    assert.equal(lead.phone, '519-555-0142')
    assert.equal(lead.weddingDate, '2027-11-08')
    assert.equal(lead.service, 'full')
    assert.equal(lead.withStag, true)
    assert.equal(lead.stagDate, '2027-10-18')
    assert.equal(lead.message, 'Evening ceremony by the lake')
  })

  it('refuses a token the existing book does not know', async () => {
    const response = await deskLeadsResponse(
      new Request('http://localhost/api/bots/v1/leads', {
        headers: { authorization: 'Bearer missing-bot' },
      }),
      async () => 'no',
    )
    assert.equal(response.status, 401)
    const body = (await response.json()) as { error: string; leads?: unknown }
    assert.match(body.error, /token from join/)
    assert.equal(body.leads, undefined)
  })

  it('does not open the list when the token cannot be checked', async () => {
    const response = await deskLeadsResponse(
      new Request('http://localhost/api/bots/v1/leads'),
      async () => 'yes',
    )
    assert.equal(response.status, 401)
  })
})

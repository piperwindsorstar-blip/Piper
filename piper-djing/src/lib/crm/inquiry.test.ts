import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { createInquiry, listLeads } from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)

describe('inquiries', { skip: liveBook }, () => {
  it('saves a lead with the stag and doe choice before any thank-you', async () => {
    const result = await createInquiry({
      partnerOne: 'Casey',
      partnerTwo: 'Drew',
      email: 'casey@example.com',
      phone: '519-555-0100',
      eventDate: '2026-12-20',
      packageId: 'full',
      withStag: true,
      stagDate: '2026-11-08',
      message: 'Outdoor ceremony',
    })
    assert.equal(result.ok, true)
    const leads = await listLeads()
    const lead = leads.find((item) => item.email === 'casey@example.com')
    assert.ok(lead)
    assert.equal(lead.partnerOne, 'Casey')
    assert.equal(lead.partnerTwo, 'Drew')
    assert.equal(lead.phone, '519-555-0100')
    assert.equal(lead.eventDate, '2026-12-20')
    assert.equal(lead.packageId, 'full')
    assert.equal(lead.withStag, true)
    assert.equal(lead.stagDate, '2026-11-08')
    assert.equal(lead.message, 'Outdoor ceremony')
  })

  it('still saves the lead when the date is already held', async () => {
    const first = await createInquiry({
      partnerOne: 'Erin',
      partnerTwo: 'Finn',
      email: 'erin@example.com',
      phone: '',
      eventDate: '2026-12-22',
      packageId: 'ceremony',
      withStag: false,
      stagDate: null,
      message: '',
    })
    assert.equal(first.ok, true)
    const second = await createInquiry({
      partnerOne: 'Gale',
      partnerTwo: 'Harper',
      email: 'gale@example.com',
      phone: '519-555-0199',
      eventDate: '2026-12-22',
      packageId: 'reception',
      withStag: false,
      stagDate: null,
      message: 'Second inquiry',
    })
    assert.equal(second.ok, true)
    const leads = await listLeads()
    const saved = leads.filter((lead) => lead.eventDate === '2026-12-22')
    assert.equal(saved.length, 2)
    assert.equal(
      saved.some((lead) => lead.withStag),
      false,
    )
  })

  it('does not save a lead when the inquiry is invalid', async () => {
    const result = await createInquiry({
      partnerOne: 'Ivy',
      partnerTwo: 'Jules',
      email: 'not-an-email',
      phone: '',
      eventDate: '2026-12-28',
      packageId: 'full',
      withStag: false,
      stagDate: null,
      message: '',
    })
    assert.equal(result.ok, false)
    const leads = await listLeads()
    assert.equal(
      leads.some((lead) => lead.partnerOne === 'Ivy'),
      false,
    )
  })
})

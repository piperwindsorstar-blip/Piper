import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  addPartner,
  listPartners,
  partnerLogo,
  removePartner,
} from './store.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('partner brands', { skip: liveBook }, () => {
  it('adds a logo and link, then removes it', async () => {
    assert.deepEqual(await listPartners(), [])
    const added = await addPartner({
      name: 'The Florist',
      href: 'https://example.com/flowers',
      logo: png,
    })
    assert.equal(added.name, 'The Florist')
    assert.equal(added.href, 'https://example.com/flowers')
    const listed = await listPartners()
    assert.equal(listed.length, 1)
    assert.equal(listed[0]?.id, added.id)
    assert.equal(listed[0]?.src.startsWith('data:image/png;base64,iVBOR'), true)
    const logo = await partnerLogo(added.id)
    assert.equal(logo?.mime, 'image/png')
    await removePartner(added.id)
    assert.deepEqual(await listPartners(), [])
    assert.equal(await partnerLogo(added.id), null)
  })

  it('refuses a logo that is not an image and a website that is not a link', async () => {
    await assert.rejects(
      () =>
        addPartner({
          name: 'Nope',
          href: 'https://example.com',
          logo: 'data:text/plain;base64,YQ==',
        }),
      /PNG, JPEG, or WebP/,
    )
    await assert.rejects(
      () =>
        addPartner({ name: 'Nope', href: 'javascript:alert(1)', logo: png }),
      /https:\/\//,
    )
  })
})

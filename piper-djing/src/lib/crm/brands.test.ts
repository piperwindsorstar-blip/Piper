import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import { stripCopies } from './brands.ts'
import {
  addBrand,
  brandLogo,
  listDeskBrands,
  listPublicBrands,
  moveBrand,
  removeBrand,
  setBrandShown,
  updateBrand,
} from './brands.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('brand strip copies', () => {
  it('repeats a short list enough to fill the loop', () => {
    assert.equal(stripCopies(0), 0)
    assert.equal(stripCopies(1), 12)
    assert.equal(stripCopies(5), 3)
    assert.equal(stripCopies(20), 1)
  })
})

describe('brands in the book', { skip: liveBook }, () => {
  it('starts empty, then adds, orders, hides, edits and deletes', async () => {
    assert.deepEqual(await listPublicBrands(), [])
    await addBrand({ name: 'Pioneer DJ', href: 'https://pioneerdj.example.com', logo: png })
    await addBrand({ name: 'Local Sound', logo: png })
    await assert.rejects(() => addBrand({ name: 'No logo', logo: '' }), /logo/)
    await assert.rejects(
      () => addBrand({ name: 'Bad link', href: 'http://bad.example.com', logo: png }),
      /https:\/\//,
    )
    let brands = await listPublicBrands()
    assert.deepEqual(brands.map((b) => b.name), ['Pioneer DJ', 'Local Sound'])
    const [pioneer, local] = brands
    assert.ok(pioneer && local)
    assert.equal(pioneer.href, 'https://pioneerdj.example.com/')
    assert.equal(local.href, null)
    assert.match(pioneer.logo, /^\/brand-logo\/\d+\?v=1$/)
    assert.equal((await brandLogo(pioneer.id))?.mime, 'image/png')

    await moveBrand(local.id, 'up')
    brands = await listPublicBrands()
    assert.deepEqual(brands.map((b) => b.name), ['Local Sound', 'Pioneer DJ'])

    await setBrandShown(local.id, false)
    assert.deepEqual((await listPublicBrands()).map((b) => b.name), ['Pioneer DJ'])
    assert.equal((await listDeskBrands()).length, 2)

    await updateBrand({ id: pioneer.id, name: 'Pioneer', href: '', logo: png })
    const edited = (await listPublicBrands())[0]
    assert.equal(edited?.name, 'Pioneer')
    assert.equal(edited?.href, null)
    assert.match(edited?.logo ?? '', /\?v=2$/)

    await removeBrand(pioneer.id)
    await removeBrand(local.id)
    assert.deepEqual(await listDeskBrands(), [])
  })
})

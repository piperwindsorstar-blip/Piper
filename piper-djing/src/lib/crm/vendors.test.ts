import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  STARTING_VENDOR_CATEGORIES,
  moved,
  publicVendorGroups,
  vendorWebsite,
} from './vendors.ts'
import {
  addVendor,
  addVendorCategory,
  listDeskVendors,
  listPublicVendors,
  moveVendor,
  moveVendorCategory,
  removeVendor,
  removeVendorCategory,
  renameVendorCategory,
  setVendorShown,
  updateVendor,
  vendorLogo,
} from './vendors.server.ts'

const liveBook = Boolean(process.env.DATABASE_URL)
const png =
  'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg=='

describe('vendor rules', () => {
  it('only takes https:// websites', () => {
    assert.equal(vendorWebsite(' https://example.com/flowers '), 'https://example.com/flowers')
    assert.throws(() => vendorWebsite('http://example.com'), /https:\/\//)
    assert.throws(() => vendorWebsite('example.com'), /https:\/\//)
    assert.throws(() => vendorWebsite('javascript:alert(1)'), /https:\/\//)
    assert.throws(() => vendorWebsite('https://localhost'), /https:\/\//)
  })

  it('moves one item and leaves the ends alone', () => {
    assert.deepEqual(moved([1, 2, 3], 1, 'up'), [2, 1, 3])
    assert.deepEqual(moved([1, 2, 3], 1, 'down'), [1, 3, 2])
    assert.deepEqual(moved([1, 2, 3], 0, 'up'), [1, 2, 3])
    assert.deepEqual(moved([1, 2, 3], 2, 'down'), [1, 2, 3])
  })

  it('leaves out categories with no vendors', () => {
    const groups = publicVendorGroups(
      [
        { id: 1, name: 'Venues' },
        { id: 2, name: 'Florists' },
      ],
      [{ id: 5, categoryId: 2, name: 'Bloom', href: 'https://example.com', logo: null }],
    )
    assert.deepEqual(groups, [
      {
        id: 2,
        name: 'Florists',
        vendors: [{ id: 5, name: 'Bloom', href: 'https://example.com', logo: null }],
      },
    ])
  })
})

describe('vendors in the book', { skip: liveBook }, () => {
  it('starts with the nine categories and no vendors', async () => {
    const desk = await listDeskVendors()
    assert.deepEqual(
      desk.map((category) => category.name),
      [...STARTING_VENDOR_CATEGORIES],
    )
    assert.equal(desk.every((category) => category.vendors.length === 0), true)
    assert.deepEqual(await listPublicVendors(), [])
  })

  it('adds, orders, hides, edits and deletes vendors', async () => {
    const florists = (await listDeskVendors()).find((c) => c.name === 'Florists')
    const venues = (await listDeskVendors()).find((c) => c.name === 'Venues')
    assert.ok(florists && venues)
    await addVendor({ name: 'Bloom', categoryId: florists.id, href: 'https://bloom.example.com', logo: png })
    await addVendor({ name: 'Petal', categoryId: florists.id, href: 'https://petal.example.com' })
    await assert.rejects(
      () => addVendor({ name: 'Nope', categoryId: florists.id, href: 'http://nope.example.com' }),
      /https:\/\//,
    )

    let groups = await listPublicVendors()
    assert.deepEqual(groups.map((g) => g.name), ['Florists'])
    assert.deepEqual(groups[0]?.vendors.map((v) => v.name), ['Bloom', 'Petal'])
    const bloom = groups[0]?.vendors[0]
    const petal = groups[0]?.vendors[1]
    assert.ok(bloom && petal)
    assert.match(bloom.logo ?? '', /^\/vendor-logo\/\d+\?v=1$/)
    assert.equal(petal.logo, null)
    assert.equal((await vendorLogo(bloom.id))?.mime, 'image/png')
    assert.equal(await vendorLogo(petal.id), null)

    await moveVendor(petal.id, 'up')
    groups = await listPublicVendors()
    assert.deepEqual(groups[0]?.vendors.map((v) => v.name), ['Petal', 'Bloom'])

    await setVendorShown(petal.id, false)
    groups = await listPublicVendors()
    assert.deepEqual(groups[0]?.vendors.map((v) => v.name), ['Bloom'])

    await setVendorShown(bloom.id, false)
    assert.deepEqual(await listPublicVendors(), [])
    await setVendorShown(bloom.id, true)

    await updateVendor({
      id: bloom.id,
      name: 'Bloom Studio',
      categoryId: venues.id,
      href: 'https://bloomstudio.example.com',
      removeLogo: true,
    })
    groups = await listPublicVendors()
    assert.deepEqual(groups.map((g) => g.name), ['Venues'])
    assert.equal(groups[0]?.vendors[0]?.name, 'Bloom Studio')
    assert.equal(groups[0]?.vendors[0]?.logo, null)

    await assert.rejects(() => removeVendorCategory(venues.id), /first/)
    await removeVendor(bloom.id)
    await removeVendor(petal.id)
    assert.deepEqual(await listPublicVendors(), [])
  })

  it('adds, renames, reorders and deletes categories', async () => {
    await addVendorCategory('Transport')
    await assert.rejects(() => addVendorCategory('transport'), /already/)
    let names = (await listDeskVendors()).map((c) => c.name)
    assert.equal(names.at(-1), 'Transport')
    const transport = (await listDeskVendors()).find((c) => c.name === 'Transport')
    assert.ok(transport)
    await renameVendorCategory(transport.id, 'Limos & Transport')
    await moveVendorCategory(transport.id, 'up')
    names = (await listDeskVendors()).map((c) => c.name)
    assert.equal(names.at(-2), 'Limos & Transport')
    await removeVendorCategory(transport.id)
    names = (await listDeskVendors()).map((c) => c.name)
    assert.deepEqual(names, [...STARTING_VENDOR_CATEGORIES])
  })
})

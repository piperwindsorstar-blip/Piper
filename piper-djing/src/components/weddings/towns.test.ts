import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { describe, it } from 'node:test'
import { TOWN_LIST, TOWNS } from './towns.ts'

describe('town pages', () => {
  it('has one page per town', () => {
    assert.deepEqual(
      TOWN_LIST.map((town) => town.name),
      ['Hamilton', 'Cambridge', 'Paris', 'Woodstock', 'Burlington', 'Guelph', 'Oakville'],
    )
    for (const [path, town] of Object.entries(TOWNS)) {
      assert.equal(town.path, path)
      assert.match(town.title, new RegExp(`^${town.name}.* wedding DJ \\| DJ Piper P$`))
    }
  })

  it('gives every town its own words, not a copy', () => {
    const texts = TOWN_LIST.flatMap((town) => [town.description, town.intro, ...town.body])
    assert.equal(new Set(texts).size, texts.length)
    for (const town of TOWN_LIST) {
      assert.ok(town.description.length < 155, `${town.name} description is too long`)
      assert.ok(town.description.includes(town.name))
    }
  })

  it('answers travel for that town first, then the general questions', () => {
    for (const town of TOWN_LIST) {
      assert.equal(town.faq[0]?.[0], `Do you charge travel to ${town.name}?`)
      assert.equal(town.faq[0]?.[1], town.travel)
      assert.equal(town.faq.filter(([q]) => /travel/i.test(q)).length, 1)
    }
  })

  it('keeps the home street off the public town pages', () => {
    for (const town of TOWN_LIST) {
      assert.doesNotMatch(JSON.stringify(town), /Butcher/)
    }
  })

  it('lists every town page in the sitemap', () => {
    const sitemap = readFileSync(
      new URL('../../routes/sitemap[.]xml.ts', import.meta.url),
      'utf8',
    )
    for (const town of TOWN_LIST) assert.ok(sitemap.includes(`publicUrl('${town.path}')`))
  })
})

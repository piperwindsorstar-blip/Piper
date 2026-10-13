import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_TEMPLATE,
  PHOTO_SHAPES,
  RSVP_TEMPLATES,
  photoPath,
  parsePhoto,
  parsePhotoShape,
  parseTemplateId,
  shapeLabel,
  shapeRadius,
  shapeSize,
  templateFor,
  templateName,
} from './templates.ts'
import { sampleWedding } from './demo.ts'
import { parseWedding } from './model.ts'

describe('invitation templates', () => {
  it('offers the five templates, each with its own paper and accent', () => {
    assert.equal(RSVP_TEMPLATES.length, 5)
    assert.deepEqual(
      RSVP_TEMPLATES.map((template) => template.id),
      ['ivory', 'minimal', 'blush', 'kraft', 'black-tie'],
    )
    const papers = new Set(RSVP_TEMPLATES.map((t) => t.skin.card))
    assert.equal(papers.size, 5)
    for (const template of RSVP_TEMPLATES) {
      assert.ok(template.name.length > 3)
      assert.ok(template.blurb.length > 10)
      assert.equal(template.swatch.length, 3)
      assert.ok(PHOTO_SHAPES.includes(template.skin.photoShape))
      // no web font is ever required
      assert.doesNotMatch(template.skin.displayFont, /http|@font-face/)
    }
  })

  it('keeps Classic Ivory as the default and never trusts a stray value', () => {
    assert.equal(DEFAULT_TEMPLATE, 'ivory')
    assert.equal(parseTemplateId('kraft'), 'kraft')
    assert.equal(parseTemplateId('nope'), 'ivory')
    assert.equal(parseTemplateId(undefined), 'ivory')
    assert.equal(templateFor('black-tie').name, 'Black Tie')
    assert.equal(templateName('blush'), 'Romantic Blush')
    assert.equal(parsePhotoShape('circle'), 'circle')
    assert.equal(parsePhotoShape('hexagon'), 'banner')
  })

  it('reads the templates back off a stored wedding', () => {
    const wedding = sampleWedding()
    assert.equal(wedding.template, 'ivory')
    assert.equal(wedding.photo, null)
    const stored = parseWedding(
      {
        ...wedding,
        template: 'blush',
        photo: { shape: 'circle', version: '7' },
      },
      'sarah-and-michael',
    )
    if (!stored) throw new Error('the stored wedding should parse')
    assert.equal(stored.template, 'blush')
    assert.equal(stored.photo === null ? '' : stored.photo.shape, 'circle')
    assert.equal(stored.photo === null ? '' : stored.photo.version, '7')
    const broken = parseWedding({ ...wedding, template: 42, photo: 'no' }, 'x')
    if (!broken) throw new Error('a stray value should still parse')
    assert.equal(broken.template, 'ivory')
    assert.equal(broken.photo, null)
  })

  it('serves the photo from the site itself, never a third party', () => {
    const wedding = sampleWedding()
    assert.equal(photoPath(wedding.slug, null), '')
    assert.equal(
      photoPath('Sarah-and-Michael', {
        shape: 'circle',
        version: '42',
        width: 1000,
        height: 1000,
        bytes: 120_000,
      }),
      '/api/rsvp/sarah-and-michael/photo?v=42',
    )
  })

  it('crops each shape to the size the card expects', () => {
    assert.deepEqual(shapeSize('banner'), { width: 1200, height: 420 })
    assert.deepEqual(shapeSize('circle'), { width: 1000, height: 1000 })
    assert.deepEqual(shapeSize('arch'), { width: 1000, height: 1250 })
    assert.equal(shapeRadius('circle'), '50%')
    assert.equal(shapeRadius('arch'), '500px 500px 0 0')
    assert.equal(shapeRadius('banner'), '0')
    assert.equal(shapeLabel('circle'), 'Circle')
    assert.equal(shapeLabel('arch'), 'Arch')
    assert.equal(shapeLabel('banner'), 'Full-width banner')
  })

  it('keeps a photo without a version out of the record', () => {
    assert.equal(parsePhoto({ shape: 'circle' }), null)
    assert.deepEqual(parsePhoto({ version: '9', width: '1000' }), {
      shape: 'banner',
      version: '9',
      width: 1000,
      height: 0,
      bytes: 0,
    })
  })
})

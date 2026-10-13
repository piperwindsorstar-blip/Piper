import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  CENTRE_CROP,
  DEFAULT_PHOTO_SHAPE,
  DEFAULT_TEMPLATE,
  EMAIL_PHOTO_MAX_HEIGHT,
  EMAIL_PHOTO_WIDTH,
  PHOTO_SHAPES,
  RSVP_TEMPLATES,
  cropPath,
  emailPhotoBox,
  photoPath,
  photoSrc,
  parseCrop,
  parsePhoto,
  parsePhotoShape,
  parseTemplateId,
  resolvePhotoShape,
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
    assert.equal(parsePhotoShape('hexagon'), 'full')
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
        cropVersion: '42',
        crop: CENTRE_CROP,
      }),
      '/api/rsvp/sarah-and-michael/photo?v=42',
    )
  })

  it('crops each shape to the size the card expects', () => {
    assert.deepEqual(shapeSize('banner'), { width: 1200, height: 420 })
    assert.deepEqual(shapeSize('circle'), { width: 1000, height: 1000 })
    assert.deepEqual(shapeSize('arch'), { width: 1000, height: 1250 })
    assert.deepEqual(shapeSize('full'), { width: 0, height: 0 })
    assert.equal(shapeRadius('circle'), '50%')
    assert.equal(shapeRadius('arch'), '500px 500px 0 0')
    assert.equal(shapeRadius('banner'), '0')
    assert.equal(shapeRadius('full'), '0')
    assert.equal(shapeLabel('full'), 'Full photo')
    assert.equal(shapeLabel('circle'), 'Circle')
    assert.equal(shapeLabel('arch'), 'Arch')
    assert.equal(shapeLabel('banner'), 'Full-width banner')
  })

  it('offers Full photo first and keeps it as the default', () => {
    assert.equal(DEFAULT_PHOTO_SHAPE, 'full')
    assert.equal(PHOTO_SHAPES[0], 'full')
    assert.deepEqual(PHOTO_SHAPES, ['full', 'banner', 'circle', 'arch'])
    assert.equal(parsePhotoShape('full'), 'full')
    assert.equal(parsePhotoShape(undefined), 'full')
    assert.equal(parsePhotoShape('hexagon'), 'full')
    assert.equal(parsePhotoShape('circle'), 'circle')
  })

  it('shows the whole photo unless the couple positioned a crop', () => {
    const whole = {
      shape: 'circle' as const,
      version: '1',
      width: 1000,
      height: 1000,
      bytes: 100,
      cropVersion: '',
      crop: CENTRE_CROP,
    }
    // no crop stored: the picture reads whole rather than being cut twice
    assert.equal(resolvePhotoShape(whole), 'full')
    assert.equal(cropPath('sarah-and-michael', whole), '')
    assert.equal(
      photoSrc('sarah-and-michael', whole),
      '/api/rsvp/sarah-and-michael/photo?v=1',
    )
    const cropped = { ...whole, cropVersion: '1' }
    assert.equal(resolvePhotoShape(cropped), 'circle')
    assert.equal(
      cropPath('sarah-and-michael', cropped),
      '/api/rsvp/sarah-and-michael/photo?shape=circle&v=1',
    )
    assert.equal(
      photoSrc('sarah-and-michael', cropped),
      '/api/rsvp/sarah-and-michael/photo?shape=circle&v=1',
    )
    // full photo never asks for a shaped rendition
    const full = { ...whole, shape: 'full' as const, cropVersion: '1' }
    assert.equal(resolvePhotoShape(full), 'full')
    assert.equal(cropPath('sarah-and-michael', full), '')
  })

  it('keeps the couple inside the frame: 600 wide, 800 tall at most', () => {
    assert.equal(EMAIL_PHOTO_WIDTH, 600)
    assert.equal(EMAIL_PHOTO_MAX_HEIGHT, 800)
    // landscape keeps its own shape
    assert.deepEqual(emailPhotoBox('full', 1600, 900), {
      width: 600,
      height: 338,
    })
    // 4:5 portrait fits the width and stays under the cap
    assert.deepEqual(emailPhotoBox('full', 1000, 1250), {
      width: 600,
      height: 750,
    })
    // very tall portrait scales down to the cap instead of being cut
    assert.deepEqual(emailPhotoBox('full', 900, 2400), {
      width: 300,
      height: 800,
    })
    // a shape uses the crop's own size, scaled to the card
    assert.deepEqual(emailPhotoBox('circle', 1000, 1000), {
      width: 600,
      height: 600,
    })
    assert.deepEqual(emailPhotoBox('banner', 1200, 420), {
      width: 600,
      height: 210,
    })
    assert.deepEqual(emailPhotoBox('arch', 1000, 1250), {
      width: 600,
      height: 750,
    })
  })

  it('reads the saved crop, and falls back to the centre of the photo', () => {
    assert.deepEqual(parseCrop({ zoom: 1.5, panX: -0.25, panY: 0.5 }), {
      zoom: 1.5,
      panX: -0.25,
      panY: 0.5,
    })
    // never trusts a stray value: the zoom falls back, the pan stays in range
    assert.deepEqual(parseCrop({ zoom: 99, panX: 9, panY: -9 }), {
      zoom: 1,
      panX: 1,
      panY: -1,
    })
    assert.deepEqual(parseCrop(undefined), CENTRE_CROP)
    assert.deepEqual(parseCrop('nonsense'), CENTRE_CROP)
  })

  it('keeps a photo without a version out of the record', () => {
    assert.equal(parsePhoto({ shape: 'circle' }), null)
    assert.deepEqual(parsePhoto({ version: '9', width: '1000' }), {
      shape: 'full',
      version: '9',
      width: 1000,
      height: 0,
      bytes: 0,
      cropVersion: '',
      crop: CENTRE_CROP,
    })
  })
})

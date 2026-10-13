import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_TEMPLATE,
  EMAIL_PHOTO_MAX_HEIGHT,
  EMAIL_PHOTO_WIDTH,
  RSVP_TEMPLATES,
  emailPhotoBox,
  parsePhoto,
  parseTemplateId,
  photoPath,
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
      // no web font is ever required
      assert.doesNotMatch(template.skin.displayFont, /http|@font-face/)
      // the crop tool is gone: no template asks for a photo shape
      assert.equal(
        'photoShape' in template.skin,
        false,
        `${template.id} carries no photo shape`,
      )
    }
  })

  it('keeps Classic Ivory as the default and never trusts a stray value', () => {
    assert.equal(DEFAULT_TEMPLATE, 'ivory')
    assert.equal(parseTemplateId('kraft'), 'kraft')
    assert.equal(parseTemplateId('nope'), 'ivory')
    assert.equal(parseTemplateId(undefined), 'ivory')
    assert.equal(templateFor('black-tie').name, 'Black Tie')
    assert.equal(templateName('blush'), 'Romantic Blush')
  })

  it('reads the templates back off a stored wedding', () => {
    const wedding = sampleWedding()
    assert.equal(wedding.template, 'ivory')
    assert.equal(wedding.photo, null)
    const stored = parseWedding(
      {
        ...wedding,
        template: 'blush',
        // a record written while the crop tool existed
        photo: { shape: 'circle', version: '7', cropVersion: '7' },
      },
      'sarah-and-michael',
    )
    if (!stored) throw new Error('the stored wedding should parse')
    assert.equal(stored.template, 'blush')
    assert.equal(stored.photo === null ? '' : stored.photo.version, '7')
    assert.equal(
      stored.photo === null ? 'leaked' : 'shape' in stored.photo,
      false,
      'the retired shape is not carried on the photo',
    )
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
        version: '42',
        width: 1000,
        height: 1250,
        bytes: 120_000,
      }),
      '/api/rsvp/sarah-and-michael/photo?v=42',
    )
  })

  it('keeps the couple inside the letter: 600 wide, 800 tall at most', () => {
    assert.equal(EMAIL_PHOTO_WIDTH, 600)
    assert.equal(EMAIL_PHOTO_MAX_HEIGHT, 800)
    // landscape keeps its own shape
    assert.deepEqual(emailPhotoBox(1600, 900), { width: 600, height: 338 })
    // 4:5 portrait fits the width and stays under the cap
    assert.deepEqual(emailPhotoBox(1000, 1250), { width: 600, height: 750 })
    // a phone portrait scales down to the cap instead of being cut
    assert.deepEqual(emailPhotoBox(1080, 1920), { width: 450, height: 800 })
    // very tall portrait: still the whole photo, just narrower
    assert.deepEqual(emailPhotoBox(900, 2400), { width: 300, height: 800 })
    // a square
    assert.deepEqual(emailPhotoBox(1000, 1000), { width: 600, height: 600 })
    // a record without a size falls back to the card box
    assert.deepEqual(emailPhotoBox(0, 0), { width: 600, height: 800 })
  })

  it('reads a saved photo as the whole picture, whatever the record says', () => {
    assert.equal(parsePhoto({ shape: 'circle' }), null)
    assert.deepEqual(parsePhoto({ version: '9', width: '1000' }), {
      version: '9',
      width: 1000,
      height: 0,
      bytes: 0,
    })
    // the retired crop keys are ignored, never re-applied
    assert.deepEqual(
      parsePhoto({
        version: '7',
        width: 1080,
        height: 1920,
        bytes: 200_000,
        shape: 'arch',
        cropVersion: '7',
        crop: { zoom: 2, panX: 0.5, panY: -0.5 },
      }),
      { version: '7', width: 1080, height: 1920, bytes: 200_000 },
    )
  })
})

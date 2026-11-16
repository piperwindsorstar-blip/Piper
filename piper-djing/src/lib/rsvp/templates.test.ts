import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_TEMPLATE,
  inkOn,
  parseTint,
  skinFor,
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
  it('offers the eight styles, each with its own paper and three colourways', () => {
    assert.equal(RSVP_TEMPLATES.length, 8)
    assert.deepEqual(
      RSVP_TEMPLATES.map((template) => template.id),
      ['ivory', 'minimal', 'blush', 'kraft', 'black-tie', 'deco', 'garden', 'after-dark'],
    )
    const papers = new Set(RSVP_TEMPLATES.map((t) => t.skin.card))
    assert.equal(papers.size, 8)
    for (const template of RSVP_TEMPLATES) {
      assert.equal(template.tints.length, 3, `${template.id} has three colourways`)
      assert.equal(new Set(template.tints.map((tint) => tint.name)).size, 3)
      for (const tint of template.tints) {
        assert.match(tint.accent, /^#[0-9A-F]{6}$/i)
        assert.match(tint.accentInk, /^#[0-9A-F]{6}$/i)
      }
    }
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

describe('colourways', () => {
  it('reads a stored colourway safely', () => {
    assert.equal(parseTint(1), 1)
    assert.equal(parseTint('2'), 2)
    assert.equal(parseTint(3), 0)
    assert.equal(parseTint('x'), 0)
    assert.equal(parseTint(undefined), 0)
  })

  it('carries the colourway into the accent, the button and the guest page', () => {
    const sage = skinFor('ivory', 1)
    assert.equal(sage.tint.name, 'Sage')
    assert.equal(sage.skin.accent, '#7D8C6A')
    assert.equal(sage.skin.button.bg, '#7D8C6A')
    // ivory keeps following the couple's own light or dark page
    assert.equal(sage.skin.web, undefined)
    const night = skinFor('deco', 1)
    assert.equal(night.skin.card, '#121A33')
    assert.equal(night.skin.web?.vars['--surface'], '#121A33')
    assert.equal(night.skin.web?.vars['--pink'], '#D4AF5A')
    const neon = skinFor('after-dark', 0)
    assert.equal(neon.skin.web?.light, false)
    assert.equal(neon.skin.button.fg, '#111111')
    // a stray style or colourway falls back instead of breaking
    assert.equal(skinFor('nope', 9).template.id, 'ivory')
    assert.equal(skinFor('nope', 9).tint.name, 'Antique gold')
  })

  it('picks readable ink for a filled button', () => {
    assert.equal(inkOn('#111111'), '#FFFFFF')
    assert.equal(inkOn('#B6FF3B'), '#111111')
    assert.equal(inkOn('#2F4739'), '#FFFFFF')
  })
})

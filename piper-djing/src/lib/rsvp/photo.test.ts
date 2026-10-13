import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PHOTO_TARGET_BYTES,
  chunkBase64,
  compressSteps,
  cropFrame,
  decodeBase64,
  encodeBase64,
  frameStyle,
  isHeicFile,
  joinBase64,
  parsePhotoUpload,
  photoInputError,
  photoSizeLabel,
} from './photo.ts'

describe('the couple photo', () => {
  it('accepts JPG, PNG and HEIC and turns the rest away', () => {
    assert.equal(
      photoInputError({ name: 'us.jpg', size: 2_000_000, type: 'image/jpeg' }),
      '',
    )
    assert.equal(
      photoInputError({ name: 'us.png', size: 900_000, type: 'image/png' }),
      '',
    )
    assert.equal(
      photoInputError({ name: 'IMG_1234.HEIC', size: 4_000_000, type: '' }),
      '',
    )
    assert.equal(isHeicFile({ name: 'IMG_9.heic', size: 1, type: '' }), true)
    assert.equal(
      isHeicFile({ name: 'us.jpg', size: 1, type: 'image/jpeg' }),
      false,
    )
    assert.match(
      photoInputError({ name: 'menu.pdf', size: 100, type: 'application/pdf' }),
      /JPG, PNG or HEIC/,
    )
    assert.match(
      photoInputError({
        name: 'huge.jpg',
        size: 11_000_000,
        type: 'image/jpeg',
      }),
      /over 10 MB/,
    )
    assert.match(
      photoInputError({ name: 'empty.jpg', size: 0, type: 'image/jpeg' }),
      /empty/,
    )
  })

  it('carries bytes through base64 and back, in rows', () => {
    const bytes = new Uint8Array(100_000)
    for (let index = 0; index < bytes.length; index += 1) {
      bytes[index] = (index * 7) % 256
    }
    const encoded = encodeBase64(bytes)
    const chunks = chunkBase64(encoded, 32 * 1024)
    assert.ok(chunks.length > 3)
    for (const chunk of chunks) {
      assert.equal(chunk.length % 4, 0)
    }
    const back = decodeBase64(joinBase64(chunks))
    if (!back) throw new Error('base64 should decode')
    assert.equal(back.length, bytes.length)
    assert.deepEqual(back.slice(0, 64), bytes.slice(0, 64))
    assert.deepEqual(back.slice(-64), bytes.slice(-64))
    assert.equal(decodeBase64('not base64 at all!!'), null)
  })

  it("takes the browser's trimmed photo and refuses anything else", () => {
    const dataUrl = `data:image/jpeg;base64,${encodeBase64(new Uint8Array(5000))}`
    const good = parsePhotoUpload(dataUrl, 'circle', 1000, 1000)
    assert.equal(good.ok, true)
    assert.ok(good.ok)
    assert.equal(good.photo.mime, 'image/jpeg')
    assert.equal(good.photo.bytes.length, 5000)
    assert.equal(good.photo.shape, 'circle')
    assert.equal(good.photo.width, 1000)
    const pdf = parsePhotoUpload(
      `data:application/pdf;base64,${encodeBase64(new Uint8Array(10))}`,
      'banner',
      1,
      1,
    )
    assert.equal(pdf.ok, false)
    const huge = parsePhotoUpload(
      `data:image/jpeg;base64,${encodeBase64(new Uint8Array(600_000))}`,
      'banner',
      1,
      1,
    )
    assert.equal(huge.ok, false)
    assert.equal(parsePhotoUpload('nonsense', 'banner', 1, 1).ok, false)
  })

  it('lines up the crop so the preview and the file agree', () => {
    const wide = cropFrame({
      imageWidth: 4000,
      imageHeight: 3000,
      shape: 'banner',
      zoom: 1,
      panX: 0,
      panY: 0,
    })
    assert.equal(wide.width, 1200)
    assert.equal(wide.height, 420)
    // the photo covers the frame, centred
    assert.ok(wide.drawWidth >= wide.width)
    assert.ok(wide.drawHeight >= wide.height)
    assert.ok(Math.abs(wide.x + (wide.drawWidth - wide.width) / 2) < 0.001)
    assert.ok(Math.abs(wide.y + (wide.drawHeight - wide.height) / 2) < 0.001)

    // a panorama is the one with room to pan sideways in a wide frame
    const left = cropFrame({
      imageWidth: 4000,
      imageHeight: 800,
      shape: 'banner',
      zoom: 1,
      panX: -1,
      panY: 0,
    })
    const right = cropFrame({
      imageWidth: 4000,
      imageHeight: 800,
      shape: 'banner',
      zoom: 1,
      panX: 1,
      panY: 0,
    })
    assert.equal(left.x, 0)
    assert.ok(right.x < left.x)
    assert.ok(left.x + left.drawWidth >= left.width)

    const zoomed = cropFrame({
      imageWidth: 4000,
      imageHeight: 3000,
      shape: 'banner',
      zoom: 3,
      panX: 0,
      panY: 0,
    })
    assert.ok(zoomed.drawWidth > wide.drawWidth)
    // out-of-range input is clamped, never trusted
    const edge = cropFrame({
      imageWidth: 4000,
      imageHeight: 3000,
      shape: 'banner',
      zoom: 3,
      panX: 1,
      panY: 1,
    })
    const clamped = cropFrame({
      imageWidth: 4000,
      imageHeight: 3000,
      shape: 'banner',
      zoom: 99,
      panX: 9,
      panY: -9,
    })
    assert.equal(clamped.drawWidth, edge.drawWidth)
    assert.equal(clamped.x, edge.x)
    assert.ok(clamped.drawWidth <= 4000 * 3 + 1)
  })

  it('expresses the crop as percentages for the live preview', () => {
    const frame = cropFrame({
      imageWidth: 3000,
      imageHeight: 2000,
      shape: 'circle',
      zoom: 1,
      panX: 0,
      panY: 0,
    })
    const style = frameStyle(frame)
    assert.match(style.width, /%$/)
    assert.match(style.left, /%$/)
    assert.ok(Number.parseFloat(style.width) > 100)
  })

  it('steps the encode down until the photo fits under 300 KB', () => {
    const calls: string[] = []
    const step = compressSteps(1200, (width, quality) => {
      calls.push(`${width}@${quality}`)
      return width <= 880 ? 200_000 : 500_000
    })
    assert.equal(step.width, 880)
    assert.ok(step.bytes <= PHOTO_TARGET_BYTES)
    assert.ok(calls.length >= 6)
    const never = compressSteps(1200, () => 900_000)
    assert.equal(never.bytes, 900_000)
    assert.equal(never.width, 640)
  })

  it('writes sizes the couple can read', () => {
    assert.equal(photoSizeLabel(0), '')
    assert.equal(photoSizeLabel(800), '800 B')
    assert.equal(photoSizeLabel(2048), '2.0 KB')
    assert.equal(photoSizeLabel(280_000), '273 KB')
    assert.equal(photoSizeLabel(2_500_000), '2.4 MB')
  })
})

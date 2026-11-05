import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  PHOTO_STORE_MAX,
  PHOTO_TARGET_BYTES,
  PHOTO_WIDTH_MAX,
  chunkBase64,
  compressSteps,
  decodeBase64,
  encodeBase64,
  fullFrame,
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

  it("takes the browser's photo and refuses anything else", () => {
    const dataUrl = `data:image/jpeg;base64,${encodeBase64(new Uint8Array(5000))}`
    const good = parsePhotoUpload(dataUrl, 1080, 1920)
    assert.equal(good.ok, true)
    assert.ok(good.ok)
    assert.equal(good.photo.mime, 'image/jpeg')
    assert.equal(good.photo.bytes.length, 5000)
    // the photo's own size, so a portrait stays a portrait
    assert.equal(good.photo.width, 1080)
    assert.equal(good.photo.height, 1920)
    const pdf = parsePhotoUpload(
      `data:application/pdf;base64,${encodeBase64(new Uint8Array(10))}`,
      1,
      1,
    )
    assert.equal(pdf.ok, false)
    const huge = parsePhotoUpload(
      `data:image/jpeg;base64,${encodeBase64(
        new Uint8Array(PHOTO_STORE_MAX + 1),
      )}`,
      1,
      1,
    )
    assert.equal(huge.ok, false)
    assert.equal(parsePhotoUpload('nonsense', 1, 1).ok, false)
  })

  it("keeps the photo's own proportions and falls back when they are unknown", () => {
    const dataUrl = `data:image/jpeg;base64,${encodeBase64(new Uint8Array(64))}`
    const landscape = parsePhotoUpload(dataUrl, 1600, 900)
    assert.ok(landscape.ok)
    assert.equal(landscape.photo.width, 1600)
    assert.equal(landscape.photo.height, 900)
    // a missing or silly size falls back to the upload width, never to zero
    const unknown = parsePhotoUpload(dataUrl, 0, undefined)
    assert.ok(unknown.ok)
    assert.equal(unknown.photo.width, PHOTO_WIDTH_MAX)
    assert.equal(unknown.photo.height, PHOTO_WIDTH_MAX)
    const absurd = parsePhotoUpload(dataUrl, -5, 'nonsense')
    assert.ok(absurd.ok)
    assert.equal(absurd.photo.width, PHOTO_WIDTH_MAX)
    assert.equal(absurd.photo.height, PHOTO_WIDTH_MAX)
  })

  it('shows the whole photo at its own shape, never trimmed', () => {
    // the canvas is the photo, so nothing can be cut off
    const wide = fullFrame(1200, 900)
    assert.deepEqual(wide, {
      x: 0,
      y: 0,
      drawWidth: 1200,
      drawHeight: 900,
      width: 1200,
      height: 900,
    })
    // a tall portrait stays tall: same proportions, no trimming
    const tall = fullFrame(450, 1200)
    assert.equal(tall.width, 450)
    assert.equal(tall.height, 1200)
    assert.ok(Math.abs(tall.width / tall.height - 450 / 1200) < 0.0001)
    // and a smaller photo is left exactly as it is
    assert.deepEqual(fullFrame(640, 480), {
      x: 0,
      y: 0,
      drawWidth: 640,
      drawHeight: 480,
      width: 640,
      height: 480,
    })
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

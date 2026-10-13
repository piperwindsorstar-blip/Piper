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
  fullFrame,
  isHeicFile,
  joinBase64,
  parsePhotoUpload,
  photoInputError,
  photoSizeLabel,
  sourceRect,
  uploadFrames,
} from './photo.ts'
import { shapeSize } from './templates.ts'

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
    // a zoom or a pan is ignored: a full photo is never cropped
    const frame = cropFrame({
      imageWidth: 1200,
      imageHeight: 900,
      shape: 'full',
      zoom: 3,
      panX: 1,
      panY: -1,
    })
    assert.deepEqual(frame, wide)

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

  it('stores the whole photo beside a crop, never instead of it', () => {
    const base = {
      imageWidth: 4000,
      imageHeight: 3000,
      zoom: 1,
      panX: 0,
      panY: 0,
    }
    // "Full photo" writes the photo itself and asks for no crop at all.
    const full = uploadFrames({ ...base, shape: 'full' })
    assert.deepEqual(full.whole, fullFrame(4000, 3000))
    assert.equal(full.crop, null)
    for (const shape of ['banner', 'circle', 'arch'] as const) {
      // Zooming and panning move the crop, and must never reach the stored
      // whole photo: a couple who picks a shape can still go back to "Full
      // photo" and get the picture they uploaded.
      const frames = uploadFrames({
        ...base,
        shape,
        zoom: 2.5,
        panX: 0.75,
        panY: -1,
      })
      assert.deepEqual(
        frames.whole,
        fullFrame(4000, 3000),
        `${shape} still stores the whole photo`,
      )
      assert.deepEqual(
        { width: frames.crop?.width, height: frames.crop?.height },
        shapeSize(shape),
        `${shape} crops to its own frame`,
      )
    }
  })

  it('centres every crop on the middle of the photo by default', () => {
    for (const shape of ['banner', 'circle', 'arch'] as const) {
      const frame = cropFrame({
        imageWidth: 4000,
        imageHeight: 3000,
        shape,
        zoom: 1,
        panX: 0,
        panY: 0,
      })
      // the frame sits over the middle of the photo, so a face is not cut off
      const rect = sourceRect({
        imageWidth: 4000,
        imageHeight: 3000,
        shape,
        zoom: 1,
        panX: 0,
        panY: 0,
      })
      const centreX = rect.x + rect.width / 2
      const centreY = rect.y + rect.height / 2
      assert.ok(Math.abs(centreX - 2000) < 1, `${shape} is centred across`)
      assert.ok(Math.abs(centreY - 1500) < 1, `${shape} is centred down`)
      assert.equal(frame.x, 0 - (frame.drawWidth - frame.width) / 2 + 0)
    }
  })

  it('moves the kept part of the photo when the couple drags the frame', () => {
    const base = {
      imageWidth: 4000,
      imageHeight: 800,
      shape: 'banner' as const,
    }
    const middle = sourceRect({ ...base, zoom: 1, panX: 0, panY: 0 })
    const left = sourceRect({ ...base, zoom: 1, panX: -1, panY: 0 })
    const right = sourceRect({ ...base, zoom: 1, panX: 1, panY: 0 })
    // the whole photo's height is always kept in a wide banner
    assert.ok(middle.height >= 799)
    // panning left shows the left of the photo, panning right the right
    assert.ok(left.x < middle.x)
    assert.ok(right.x > middle.x)
    // and the frame never runs past the edge of the photo
    assert.ok(left.x >= -0.001)
    assert.ok(right.x + right.width <= 4000.001)
  })

  it('keeps the whole photo in view for a full-frame crop', () => {
    const rect = sourceRect({
      imageWidth: 1000,
      imageHeight: 1250,
      shape: 'full',
      zoom: 1,
      panX: 0,
      panY: 0,
    })
    assert.deepEqual(rect, { x: 0, y: 0, width: 1000, height: 1250 })
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

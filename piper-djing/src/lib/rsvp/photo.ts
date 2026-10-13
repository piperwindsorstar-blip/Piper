/**
 * The couple's photo, from the file they pick to the bytes the Worker serves.
 *
 * The browser does the work — decode, straighten, resize, re-encode — so no
 * image ever leaves the machine at full size and the Worker only ever stores a
 * small JPEG. These helpers are pure: the canvas code and the store both use
 * them, and the tests can exercise the whole path without a browser.
 */

/** What a couple may pick. */
export const PHOTO_SOURCE_MAX = 10 * 1024 * 1024
export const PHOTO_MIMES = ['image/jpeg', 'image/png', 'image/webp'] as const
export const PHOTO_WIDTH_MAX = 1200
/** The target the canvas keeps aiming at. */
export const PHOTO_TARGET_BYTES = 300 * 1024
/** The ceiling the desk will accept, with room for the odd stubborn frame. */
export const PHOTO_STORE_MAX = 512 * 1024
/** Row size for the stored base64. A multiple of four keeps every row valid. */
export const PHOTO_CHUNK = 32 * 1024

export type PhotoFile = {
  name: string
  size: number
  type: string
}

export function isHeicFile(file: PhotoFile): boolean {
  return /image\/hei[cf]/i.test(file.type) || /\.(heic|heif)$/i.test(file.name)
}

/** What to tell the couple about the file they picked. Empty when it is fine. */
export function photoInputError(file: PhotoFile): string {
  const named = /\.(jpe?g|png|heic|heif)$/i.test(file.name)
  const known =
    (PHOTO_MIMES as readonly string[]).includes(file.type) ||
    isHeicFile(file) ||
    named
  if (!known) return 'Choose a JPG, PNG or HEIC photo.'
  if (file.size <= 0) return 'That file looks empty. Try another photo.'
  if (file.size > PHOTO_SOURCE_MAX) return 'That photo is over 10 MB.'
  return ''
}

/** Base64 for bytes, in steps, so a large photo cannot blow the call stack. */
export function encodeBase64(bytes: Uint8Array): string {
  let binary = ''
  const step = 8192
  for (let index = 0; index < bytes.length; index += step) {
    binary += String.fromCharCode(...bytes.subarray(index, index + step))
  }
  return btoa(binary)
}

/** Bytes back out of base64. Null when the text is not base64 at all. */
export function decodeBase64(text: string): Uint8Array | null {
  try {
    const binary = atob(text.replace(/\s+/g, ''))
    const bytes = new Uint8Array(binary.length)
    for (let index = 0; index < binary.length; index += 1) {
      bytes[index] = binary.charCodeAt(index)
    }
    return bytes
  } catch {
    return null
  }
}

/** Cuts the base64 into rows that each stand alone. */
export function chunkBase64(
  text: string,
  size: number = PHOTO_CHUNK,
): string[] {
  const step = Math.max(4, size - (size % 4))
  const chunks: string[] = []
  for (let index = 0; index < text.length; index += step) {
    chunks.push(text.slice(index, index + step))
  }
  return chunks.length > 0 ? chunks : ['']
}

export function joinBase64(chunks: string[]): string {
  return chunks.join('')
}

export type DecodedPhoto = {
  mime: string
  bytes: Uint8Array
  width: number
  height: number
}

/**
 * Reads the data URL the browser sends after it has straightened and shrunk the
 * photo. Returns a reason when it is not something the site will store.
 */
export function parsePhotoUpload(
  value: unknown,
  width: unknown,
  height: unknown,
): { ok: true; photo: DecodedPhoto } | { ok: false; error: string } {
  if (typeof value !== 'string' || !value.startsWith('data:')) {
    return { ok: false, error: 'That upload was not a photo.' }
  }
  const comma = value.indexOf(',')
  if (comma < 0) return { ok: false, error: 'That upload was not a photo.' }
  const header = value.slice(5, comma)
  const mime = header.split(';')[0]?.trim().toLowerCase() ?? ''
  if (!(PHOTO_MIMES as readonly string[]).includes(mime)) {
    return { ok: false, error: 'Save the photo as a JPG, PNG or WebP.' }
  }
  const bytes = decodeBase64(value.slice(comma + 1))
  if (!bytes || bytes.length === 0) {
    return { ok: false, error: 'That upload could not be read.' }
  }
  if (bytes.length > PHOTO_STORE_MAX) {
    return {
      ok: false,
      error: 'That photo is still over 500 KB after resizing.',
    }
  }
  // The photo keeps its own shape, so its size comes from the file itself.
  return {
    ok: true,
    photo: {
      mime,
      bytes,
      width: whole(width, PHOTO_WIDTH_MAX),
      height: whole(height, PHOTO_WIDTH_MAX),
    },
  }
}

function whole(value: unknown, fallback: number): number {
  const number = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(number) || number <= 0) return fallback
  return Math.min(Math.round(number), 4000)
}

export function photoSizeLabel(bytes: number): string {
  if (bytes <= 0) return ''
  if (bytes < 1024) return `${bytes} B`
  const kb = bytes / 1024
  if (kb < 1024) return `${kb < 10 ? kb.toFixed(1) : Math.round(kb)} KB`
  return `${(kb / 1024).toFixed(1)} MB`
}

/**
 * Shrinks a canvas to a JPG under the target size. Pure maths on top of a
 * caller-supplied encoder, so the tests can drive it with a stub and the
 * browser drives it with a real canvas.
 */
export function compressSteps(
  maxWidth: number,
  encode: (width: number, quality: number) => number,
): { width: number; quality: number; bytes: number } {
  const widths = [maxWidth, 1000, 880, 760, 640].filter(
    (value, index, all) => value <= maxWidth && all.indexOf(value) === index,
  )
  const qualities = [0.82, 0.7, 0.58, 0.46, 0.36]
  let last = { width: maxWidth, quality: qualities[0], bytes: 0 }
  for (const width of widths) {
    for (const quality of qualities) {
      const bytes = encode(width, quality)
      last = { width, quality, bytes }
      if (bytes <= PHOTO_TARGET_BYTES) return last
    }
  }
  return last
}

export type PhotoFrame = {
  /** Where the photo is drawn on the finished canvas, in frame pixels. */
  x: number
  y: number
  drawWidth: number
  drawHeight: number
  /** The canvas itself: the photo's own size. */
  width: number
  height: number
}

/**
 * The whole photo on the canvas, one pixel to one pixel: nothing is trimmed,
 * stretched or shrunk. The canvas takes the photo's own shape, so a portrait
 * stays a portrait and a landscape stays a landscape. (The upload path has
 * already capped the width, so this stays within the stored bounds.)
 */
export function fullFrame(imageWidth: number, imageHeight: number): PhotoFrame {
  const width = Math.max(1, Math.round(imageWidth))
  const height = Math.max(1, Math.round(imageHeight))
  return {
    x: 0,
    y: 0,
    drawWidth: width,
    drawHeight: height,
    width,
    height,
  }
}

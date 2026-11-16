/** Logo uploads from the desk, shrunk in the browser before they are sent. */

const LOGO_BOX = { width: 600, height: 300 }
const LOGO_MAX_BYTES = 200_000

function loadImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    if (!file.type.startsWith('image/') || file.type === 'image/svg+xml') {
      reject(new Error('Use a PNG, JPEG, or WebP logo.'))
      return
    }
    const url = URL.createObjectURL(file)
    const image = new Image()
    image.onload = () => {
      URL.revokeObjectURL(url)
      resolve(image)
    }
    image.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('That logo did not load. Try a PNG or JPEG.'))
    }
    image.src = url
  })
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result ?? ''))
    reader.onerror = () => reject(new Error('That logo did not load.'))
    reader.readAsDataURL(blob)
  })
}

function canvasBlob(canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => canvas.toBlob(resolve, type, quality))
}

/** Shrinks a logo to fit 600 × 300 and compresses it, keeping transparency. */
export async function shrinkLogo(file: File): Promise<string> {
  const image = await loadImage(file)
  const scale = Math.min(
    1,
    LOGO_BOX.width / image.naturalWidth,
    LOGO_BOX.height / image.naturalHeight,
  )
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round(image.naturalWidth * scale))
  canvas.height = Math.max(1, Math.round(image.naturalHeight * scale))
  const context = canvas.getContext('2d')
  if (!context) throw new Error('That logo did not load.')
  context.drawImage(image, 0, 0, canvas.width, canvas.height)
  for (const quality of [0.85, 0.7, 0.55]) {
    const webp = await canvasBlob(canvas, 'image/webp', quality)
    if (webp && webp.type === 'image/webp' && webp.size <= LOGO_MAX_BYTES) {
      return blobToDataUrl(webp)
    }
  }
  // Browsers that can't write WebP: PNG keeps transparency.
  const png = await canvasBlob(canvas, 'image/png', 1)
  if (png && png.size <= LOGO_MAX_BYTES) return blobToDataUrl(png)
  throw new Error('That logo is too detailed to shrink. Try a simpler image.')
}

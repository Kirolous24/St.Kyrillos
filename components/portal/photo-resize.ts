import { isReadableImage } from '@/lib/portal/photo-file'

/**
 * Photos are stored as small data URLs on the row itself — there is no object
 * storage — so the browser does the shrinking: at most 256×256, re-encoded as
 * JPEG and squeezed under ~60 KB before it is ever posted. The server checks
 * the prefix and the length again; this is a courtesy, not a control.
 *
 * Shared by the single-photo uploader and Class photos (2026-10-25). Any
 * picture the browser can draw is taken (an iPhone's HEIC in Safari, WebP),
 * since it leaves here as a JPEG either way.
 */
export const PHOTO_MAX_EDGE = 256
const MAX_EDGE = PHOTO_MAX_EDGE
const TARGET_CHARS = 60_000

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('That photo could not be read. Try a JPEG or PNG.'))
    img.src = src
  })
}

function readAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new Error('That photo could not be read. Try a JPEG or PNG.'))
    reader.readAsDataURL(file)
  })
}

/**
 * The chosen photo, ready to draw, without a blob: URL (2026-10-25). The
 * portal's Content Security Policy allows images from 'self' and data: only,
 * so loading the file through an object (blob:) URL was refused and no photo
 * could ever be saved. The browser decodes the file directly where it can,
 * and through a data: URL otherwise. tests/portal/photo-csp.test.ts holds the
 * two files together.
 */
async function decode(file: File): Promise<{ source: CanvasImageSource; width: number; height: number; done: () => void }> {
  if (typeof createImageBitmap === 'function') {
    try {
      const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
      return { source: bitmap, width: bitmap.width, height: bitmap.height, done: () => bitmap.close() }
    } catch {
      // Not decodable this way in this browser: try the data: URL below.
    }
  }
  const img = await loadImage(await readAsDataUrl(file))
  return { source: img, width: img.naturalWidth, height: img.naturalHeight, done: () => {} }
}

export async function downscalePhoto(file: File): Promise<string> {
  if (!isReadableImage(file)) throw new Error('Choose a photo.')
  if (file.size > 20 * 1024 * 1024) throw new Error('That photo is very large. Try one under 20 MB.')

  const image = await decode(file)
  try {
    const longest = Math.max(image.width, image.height) || MAX_EDGE
    const scale = Math.min(1, MAX_EDGE / longest)
    const width = Math.max(1, Math.round(image.width * scale))
    const height = Math.max(1, Math.round(image.height * scale))

    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('This browser cannot resize images.')
    // JPEG has no alpha: flatten onto the cream page ground rather than black.
    ctx.fillStyle = '#FFFDF8'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image.source, 0, 0, width, height)

    let quality = 0.82
    let out = canvas.toDataURL('image/jpeg', quality)
    while (out.length > TARGET_CHARS && quality > 0.35) {
      quality -= 0.12
      out = canvas.toDataURL('image/jpeg', quality)
    }
    if (!out.startsWith('data:image/jpeg;base64,')) throw new Error('That photo could not be converted.')
    if (out.length > TARGET_CHARS * 1.5) throw new Error('That photo is still too large. Try cropping it first.')
    return out
  } finally {
    image.done()
  }
}

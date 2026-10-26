// Which files the photo pickers take, and how a class's photos are listed
// (2026-10-25). Pure: the shrinking itself needs a browser
// (components/portal/photo-resize.ts).

const IMAGE_NAME = /\.(jpe?g|png|heic|heif|webp|gif|bmp|avif)$/i

/**
 * Any picture the browser was handed. Every photo is redrawn as a small JPEG
 * before it is sent, so the format it came in does not matter, only that it
 * is a picture. Some browsers leave the type of an iPhone photo blank, so the
 * name decides then.
 */
export function isReadableImage(file: { type: string; name: string }): boolean {
  if (file.type) return file.type.startsWith('image/')
  return IMAGE_NAME.test(file.name)
}

/** The children still without a photo first, then the rest, each by name. */
export function photoOrder<T extends { name: string; photo: string | null }>(kids: readonly T[]): T[] {
  return [...kids].sort((a, b) => Number(!!a.photo) - Number(!!b.photo) || a.name.localeCompare(b.name))
}

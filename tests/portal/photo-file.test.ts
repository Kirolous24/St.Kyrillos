import { describe, it, expect } from 'vitest'
import { isReadableImage, photoOrder } from '@/lib/portal/photo-file'

/**
 * Photos for a whole class at once (2026-10-25, "Allow pictures for Pre K").
 * The browser shrinks every photo to a small JPEG before it is sent, so any
 * picture the phone can open is fine — an iPhone's HEIC included — where the
 * old picker refused all but JPEG and PNG.
 */
describe('isReadableImage', () => {
  it('takes any picture the phone or computer hands over', () => {
    for (const type of ['image/jpeg', 'image/png', 'image/heic', 'image/heif', 'image/webp', 'image/gif']) {
      expect(isReadableImage({ type, name: 'photo' })).toBe(true)
    }
  })

  it('takes a picture whose type the browser left blank, by its name', () => {
    expect(isReadableImage({ type: '', name: 'IMG_0042.HEIC' })).toBe(true)
    expect(isReadableImage({ type: '', name: 'mina.jpeg' })).toBe(true)
  })

  it('turns away anything that is not a picture', () => {
    expect(isReadableImage({ type: 'application/pdf', name: 'form.pdf' })).toBe(false)
    expect(isReadableImage({ type: '', name: 'notes.txt' })).toBe(false)
    expect(isReadableImage({ type: 'video/quicktime', name: 'clip.mov' })).toBe(false)
  })
})

describe('photoOrder', () => {
  it('puts the children still without a photo first, each half by name', () => {
    const kids = [
      { id: 'a', name: 'Mark Saad', photo: 'data:image/jpeg;base64,AAAA' },
      { id: 'b', name: 'Abanoub Hanna', photo: null },
      { id: 'c', name: 'Bishoy Fam', photo: 'data:image/jpeg;base64,BBBB' },
      { id: 'd', name: 'Youssef Adly', photo: null },
    ]
    expect(photoOrder(kids).map((k) => k.id)).toEqual(['b', 'd', 'c', 'a'])
  })
})

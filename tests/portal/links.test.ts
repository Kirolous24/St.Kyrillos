import { describe, it, expect } from 'vitest'
import { youtubeId, youtubeThumbnail } from '@/lib/portal/links'

// The class feed and the events page both preview YouTube links. They each had
// their own copy of this regex, with different URL shapes, so a /live/ link
// previewed on one surface and not the other. One implementation, one test.
describe('youtubeId', () => {
  const ID = 'dQw4w9WgXcQ'

  it('reads the id out of every shape the church actually pastes', () => {
    expect(youtubeId(`https://www.youtube.com/watch?v=${ID}`)).toBe(ID)
    expect(youtubeId(`https://youtube.com/watch?list=PL123&v=${ID}`)).toBe(ID)
    expect(youtubeId(`https://youtu.be/${ID}`)).toBe(ID)
    expect(youtubeId(`https://www.youtube.com/embed/${ID}`)).toBe(ID)
    expect(youtubeId(`https://www.youtube.com/shorts/${ID}`)).toBe(ID)
    expect(youtubeId(`https://www.youtube.com/live/${ID}`)).toBe(ID)
    expect(youtubeId(`https://www.youtube.com/watch?v=${ID}&t=42s`)).toBe(ID)
  })

  it('does not sprout a thumbnail on an unrelated link that happens to carry v=', () => {
    expect(youtubeId('https://drive.google.com/file/d/abc/view?v=somethingelse')).toBeNull()
    expect(youtubeId('https://forms.gle/abcdefghijk')).toBeNull()
    expect(youtubeId('https://vimeo.com/123456789')).toBeNull()
  })

  it('treats a missing link as no video rather than throwing', () => {
    expect(youtubeId(null)).toBeNull()
    expect(youtubeId(undefined)).toBeNull()
    expect(youtubeId('')).toBeNull()
  })

  // The portal CSP is `img-src 'self' data:`, so this URL may only ever be
  // handed to next/image, which re-serves it from /_next/image on this origin.
  // Both call sites do; this pins the host the remotePatterns entry allows.
  it('points at the img.youtube.com still that next/image is configured to fetch', () => {
    expect(youtubeThumbnail(ID)).toBe(`https://img.youtube.com/vi/${ID}/hqdefault.jpg`)
  })
})

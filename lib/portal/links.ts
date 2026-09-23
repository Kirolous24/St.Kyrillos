/**
 * Link helpers shared by the class feed and the events page.
 *
 * Both surfaces show a YouTube link as the video's own still rather than a grey
 * "Open link" pill (F0272 / F0503 / F0768), and both got the same two things
 * wrong independently before this file existed:
 *
 *   - the id regex was written twice, with two different sets of URL shapes, so
 *     a /live/ link previewed in the feed and not on the events page;
 *   - a raw `<img src="https://img.youtube.com/...">` is blocked outright by the
 *     portal's own CSP (`img-src 'self' data:` in next.config.js). It renders as
 *     a broken-image box, which is worse than the pill it replaced. The
 *     thumbnail has to go through `next/image`, which serves it from /_next/image
 *     on this origin — next.config.js already allows the upstream fetch in
 *     `images.remotePatterns`.
 */

/**
 * The 11-character video id in a YouTube URL, or null for anything else.
 *
 * Deliberately anchored on the known path shapes rather than looking for a bare
 * `v=` parameter anywhere: an unrelated link that happens to carry `?v=` should
 * not sprout a video thumbnail.
 */
export function youtubeId(url: string | null | undefined): string | null {
  if (!url) return null
  return (
    /(?:youtube\.com\/(?:watch\?(?:[^#]*&)?v=|embed\/|shorts\/|live\/)|youtu\.be\/)([\w-]{11})/.exec(url)?.[1] ?? null
  )
}

/** The still frame for a video id, as served through next/image. */
export function youtubeThumbnail(videoId: string): string {
  return `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
}

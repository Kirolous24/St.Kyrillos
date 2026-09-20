// The official SUSCOPTS "Children of Light" curriculum, Version 2.
//
// These are external Google Drive links owned by the Diocese, not files we
// host — the page is a directory, not a library. Ported verbatim from the
// prototype so servants stop hunting for them on ssc.suscopts.org.

export const CURRICULUM_HOME = 'https://ssc.suscopts.org/children-of-light-wa/'

export type CurriculumLink = { label: string; url: string }

/** Cross-grade documents: the year plan, milestones, and the feedback form. */
export const CURRICULUM_CORE: CurriculumLink[] = [
  {
    label: 'Overview and Milestones By Grade',
    url: 'https://docs.google.com/document/d/1bbwPzKG-34LxFBbRc6La6-79yHhrr6O4Dt-usi09e-c/edit?usp=sharing',
  },
  {
    label: 'Submit Feedback/Material',
    url: 'https://docs.google.com/forms/d/e/1FAIpQLSfzoJuqhE9bFgGFm063kvG6J3IWagYDBabX5ZcS52sU7vLCbw/viewform?usp=sf_link',
  },
  {
    label: 'Schedule of the Year',
    url: 'https://docs.google.com/spreadsheets/d/1xCR1DFKQ9PHHI7uf_Y0seAerkmcKUsbjg7E3mRETEQs/edit?usp=sharing',
  },
]

/** Companion curricula that sit outside the per-grade books. */
export const CURRICULUM_EXTRAS: CurriculumLink[] = [
  { label: 'Hymns Curriculum', url: 'https://ssc.suscopts.org/hymns-curriculum/' },
  { label: 'Memorization Curriculum', url: 'http://ssc.suscopts.org/wp-content/uploads/2014/12/Memorization-Curriculum.xls' },
  { label: "User's Guidelines", url: 'https://ssc.suscopts.org/users-guidelines/' },
]

export type GradeBook = {
  label: string
  pill: string
  title: string
  bookUrl: string
  slidesUrl: string | null
}

export const CURRICULUM_GRADES: GradeBook[] = [
  { label: 'Pre-K', pill: 'Pre-K', title: "God's Wonderful Works", bookUrl: 'https://drive.google.com/file/d/1VZEn2PSWmyNoeknwRdfUy6XFY_7QRhbx/preview', slidesUrl: null },
  { label: 'Kindergarten', pill: 'KG', title: 'God Loves Me', bookUrl: 'https://drive.google.com/file/d/1Ga8v0hTuT-IR4RglRVhj-c6C2DOzhz7j/preview', slidesUrl: 'https://drive.google.com/drive/folders/1-E2sYhiB15lmC-qGK-r53jND-Ydn3F-h?usp=sharing' },
  { label: 'Grade 1', pill: '1st Grade', title: 'The Mighty Fatherhood of God', bookUrl: 'https://drive.google.com/file/d/1Q3YlsUu6uJAsQNa3i_eUAJf7CWZdIfmV/preview', slidesUrl: 'https://drive.google.com/drive/folders/1l4lhQmT_CU9SrAZGVdGXcALwhW1QN3JM?usp=sharing' },
  { label: 'Grade 2', pill: '2nd Grade', title: 'The Loving Motherhood of the Church', bookUrl: 'https://drive.google.com/file/d/1NaQd1CKR_03PFXWMznxcYCeQBwv-NtbF/preview', slidesUrl: 'https://drive.google.com/drive/folders/1Q6UUQ8JJb5eFGbPn644YEBE4uWlwm3PY?usp=sharing' },
  { label: 'Grade 3', pill: '3rd Grade', title: 'The Golden Rule', bookUrl: 'https://drive.google.com/file/d/1GhVFuvwa4e8-ZFZR-IpsauOsugYxMQLR/preview', slidesUrl: 'https://drive.google.com/drive/folders/1svCy3c26a1ZXKqRox9H5pUbHeDs5EZUt?usp=sharing' },
  { label: 'Grade 4', pill: '4th Grade', title: 'Growing in Discipline', bookUrl: 'https://drive.google.com/file/d/1S36_Di0_O5vULcFnXG5UVp5D4D8DHDq9/preview', slidesUrl: 'https://drive.google.com/drive/folders/1HEyCVD7X4FBviK7neEcvlhUTBzdhr_-I?usp=sharing' },
  { label: 'Grade 5', pill: '5th Grade', title: 'Life of Faith, Trust and Morality', bookUrl: 'https://drive.google.com/file/d/1pnRLPHPug0hDGrMsFhm5kGd037vgmjrr/preview', slidesUrl: 'https://drive.google.com/drive/folders/1IsH-HHUHtMEC7JmLfmUVyjkFI5z_W90u?usp=sharing' },
  { label: 'Grade 6', pill: '6th Grade', title: 'The Living Bible', bookUrl: 'https://drive.google.com/file/d/1XblBUV43ylHFWJcgLkCPWPh4x-tp1wYu/preview', slidesUrl: null },
  { label: 'Grade 7', pill: '7th Grade', title: 'Christian Discernment', bookUrl: 'https://drive.google.com/file/d/1D-E-iOLNoL4h6lPCDN4BtHn6D3DaAd0a/preview', slidesUrl: null },
  { label: 'Grade 8', pill: '8th Grade', title: 'Choosing my Faith', bookUrl: 'https://drive.google.com/file/d/1pjzeXHHlDHKXVlBYTwTQwzOAmK_4sENF/preview', slidesUrl: null },
  { label: 'Grade 9', pill: '9th Grade', title: 'Self-Control & Independence', bookUrl: 'https://drive.google.com/file/d/1l609QOhNVcUJhc6pIqYu2Ru3qFf_4k7R/preview', slidesUrl: null },
  { label: 'Grade 10', pill: '10th Grade', title: 'Repentance', bookUrl: 'https://drive.google.com/file/d/1UJa45qfICjrYXqoUo098Wdf5nUk8ifXt/preview', slidesUrl: null },
  { label: 'Grade 11', pill: '11th Grade', title: 'Consecration', bookUrl: 'https://drive.google.com/file/d/1bo4A6Urh9aKoQ0KWiTHLsp8LJU_LtmdN/preview', slidesUrl: null },
  { label: 'Grade 12', pill: '12th Grade', title: 'Service', bookUrl: 'https://drive.google.com/file/d/1C6_P03qV-O_85urqa5kX-l56FMOrQBBm/preview', slidesUrl: null },
]

/** Cover gradients, cycled across the grade grid so adjacent books differ. */
export const COVER_PALETTES: ReadonlyArray<readonly [string, string]> = [
  ['#4A6B7A', '#2E4A56'], // slate blue
  ['#1B4870', '#0F2E4D'], // navy
  ['#7A2020', '#4A1414'], // burgundy
  ['#8B5A0F', '#5C3A08'], // amber brown
  ['#2F6B4F', '#1D4433'], // forest green
  ['#5A3D7A', '#3A2652'], // plum
]

export function paletteFor(index: number): readonly [string, string] {
  return COVER_PALETTES[index % COVER_PALETTES.length]!
}

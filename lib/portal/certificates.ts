// The prototype's four certificate wordings, verbatim (OG L6534-6537).

export type CertificateOccasion = 'attendance' | 'excellence' | 'completion' | 'participation'

export interface CertificateText {
  key: CertificateOccasion
  title: string
  line: string
}

export const CERTIFICATE_OCCASIONS: readonly CertificateText[] = [
  {
    key: 'attendance',
    title: 'Certificate of Perfect Attendance',
    line: 'has faithfully attended Sunday School with perfect attendance during',
  },
  {
    key: 'excellence',
    title: 'Certificate of Academic Excellence',
    line: 'has demonstrated outstanding academic excellence during',
  },
  {
    key: 'completion',
    title: 'Certificate of Completion',
    line: 'has successfully completed the Sunday School program for',
  },
  {
    key: 'participation',
    title: 'Certificate of Outstanding Participation',
    line: 'has shown outstanding participation and dedication during',
  },
]

export function certificateText(key: string | undefined): CertificateText {
  return CERTIFICATE_OCCASIONS.find((o) => o.key === key) ?? CERTIFICATE_OCCASIONS[0]!
}

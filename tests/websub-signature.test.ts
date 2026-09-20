import { describe, it, expect } from 'vitest'
import { createHmac } from 'node:crypto'
import { verifyHubSignature } from '@/lib/websub-signature'

const SECRET = 'top-secret-with-$pecial/chars=+&'
const BODY = '<feed><entry><yt:videoId>abc123</yt:videoId></entry></feed>'
const sign = (body: string, secret: string) => 'sha1=' + createHmac('sha1', secret).update(body).digest('hex')

describe('verifyHubSignature', () => {
  it('accepts a correct sha1 HMAC of the raw body', () => {
    expect(verifyHubSignature(BODY, sign(BODY, SECRET), SECRET)).toBe(true)
  })

  it('rejects a signature made with a different secret', () => {
    expect(verifyHubSignature(BODY, sign(BODY, 'other'), SECRET)).toBe(false)
  })

  it('rejects when the body was tampered with', () => {
    expect(verifyHubSignature(BODY + ' ', sign(BODY, SECRET), SECRET)).toBe(false)
  })

  it('rejects a missing, malformed, or wrong-length header', () => {
    expect(verifyHubSignature(BODY, null, SECRET)).toBe(false)
    expect(verifyHubSignature(BODY, '', SECRET)).toBe(false)
    expect(verifyHubSignature(BODY, 'sha1=deadbeef', SECRET)).toBe(false)
    expect(verifyHubSignature(BODY, 'md5=' + 'a'.repeat(40), SECRET)).toBe(false)
  })

  it('is case-insensitive on the hex digest', () => {
    expect(verifyHubSignature(BODY, sign(BODY, SECRET).toUpperCase().replace('SHA1', 'sha1'), SECRET)).toBe(true)
  })
})

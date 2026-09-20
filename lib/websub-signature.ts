import { createHmac, timingSafeEqual } from 'node:crypto'

// WebSub (PubSubHubbub) content-distribution signature check.
// The hub signs the raw request body with the hub.secret we gave it at
// subscribe time and sends it as `X-Hub-Signature: sha1=<hex>`.
// Spec: https://www.w3.org/TR/websub/#authenticated-content-distribution

export function verifyHubSignature(
  rawBody: string,
  signatureHeader: string | null | undefined,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false
  const match = /^sha1=([0-9a-f]{40})$/i.exec(signatureHeader.trim())
  if (!match) return false

  const expected = createHmac('sha1', secret).update(rawBody, 'utf8').digest()
  const provided = Buffer.from(match[1], 'hex')
  if (provided.length !== expected.length) return false
  return timingSafeEqual(provided, expected)
}

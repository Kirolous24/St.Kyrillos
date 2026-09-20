// Pure builder for the "new member" email. Every submitted value is escaped
// before it is placed in HTML, and the subject / reply-to are sanitized so a
// crafted form submission can't inject markup or mail headers.

export interface MembershipFields {
  firstName?: unknown
  lastName?: unknown
  email?: unknown
  phone?: unknown
  address?: unknown
  city?: unknown
  state?: unknown
  zip?: unknown
  dob?: unknown
  gender?: unknown
  maritalStatus?: unknown
  hasChildren?: unknown
}

export interface MembershipEmail {
  subject: string
  html: string
  replyTo?: string
}

const ESCAPES: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}

export function escapeHtml(value: unknown): string {
  if (value === undefined || value === null) return ''
  return String(value).replace(/[&<>"']/g, (ch) => ESCAPES[ch])
}

/** Conservative shape check: one @, a dot in the domain, no whitespace or control chars. */
export function isValidEmail(value: unknown): value is string {
  if (typeof value !== 'string') return false
  if (value.length > 254) return false
  return /^[^\s@<>()[\],;:\\"]+@[^\s@<>()[\],;:\\"]+\.[^\s@<>()[\],;:\\"]{2,}$/.test(value)
}

/** Single line, trimmed, bounded — safe for a mail header. */
function headerSafe(value: unknown, max = 100): string {
  return String(value ?? '').replace(/[\r\n\t]+/g, ' ').trim().slice(0, max)
}

export function buildMembershipEmail(fields: MembershipFields): MembershipEmail {
  const firstName = headerSafe(fields.firstName)
  const lastName = headerSafe(fields.lastName)
  const email = typeof fields.email === 'string' ? fields.email.trim() : ''
  const validEmail = isValidEmail(email)

  const addressLine = [fields.address, fields.city, fields.state, fields.zip]
    .map((v) => (v === undefined || v === null ? '' : String(v).trim()))
    .filter(Boolean)
    .join(', ')

  const row = (label: string, value: string, shade: string) =>
    `<tr><td style="padding: 7px 12px; color: #666; width: 150px; background:${shade};">${label}</td>` +
    `<td style="padding: 7px 12px;">${value}</td></tr>`

  const emailCell = validEmail
    ? `<a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a>`
    : escapeHtml(email)

  const html = `
        <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; color: #222; line-height: 1.6;">
          <p>Hello Father,</p>
          <p>A new member has signed up. Here is their info:</p>

          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            ${row('Name', escapeHtml(`${firstName} ${lastName}`.trim()), '#f7f7f7')}
            ${row('Email', emailCell, '#f0f0f0')}
            ${row('Phone', escapeHtml(fields.phone), '#f7f7f7')}
            ${row('Address', escapeHtml(addressLine), '#f0f0f0')}
            ${row('Date of Birth', escapeHtml(fields.dob), '#f7f7f7')}
            ${row('Gender', escapeHtml(fields.gender), '#f0f0f0')}
            ${row('Marital Status', escapeHtml(fields.maritalStatus), '#f7f7f7')}
            ${row('Has Children', escapeHtml(fields.hasChildren), '#f0f0f0')}
          </table>
        </div>
      `

  return {
    subject: `New Member — ${firstName} ${lastName}`.trim(),
    html,
    replyTo: validEmail ? email : undefined,
  }
}

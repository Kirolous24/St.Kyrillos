import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'
import { buildMembershipEmail, isValidEmail } from '@/lib/membership-email'

const TO_EMAIL = 'fr.pachom@stkyrillostn.org'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY2)

  let data: Record<string, unknown>
  try {
    data = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid request body' }, { status: 400 })
  }

  const { firstName, lastName, email } = data

  // Basic validation
  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }
  if (!isValidEmail(email)) {
    return NextResponse.json({ error: 'Please enter a valid email address' }, { status: 400 })
  }

  // All submitted values are HTML-escaped and header-sanitized in the builder.
  const { subject, html, replyTo } = buildMembershipEmail(data)

  try {
    await resend.emails.send({
      from: 'St. Kyrillos Website <noreply@stkyrillostn.org>',
      to: TO_EMAIL,
      replyTo,
      subject,
      html,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Membership email error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}

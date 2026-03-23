import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const resend = new Resend(process.env.RESEND_API_KEY)
const TO_EMAIL = 'fr.pachom@stkyrillostn.org'

export async function POST(req: NextRequest) {
  const data = await req.json()

  const {
    firstName, lastName, email, phone,
    address, city, state, zip, dob,
    gender, maritalStatus, hasChildren,
  } = data

  // Basic validation
  if (!firstName || !lastName || !email) {
    return NextResponse.json({ error: 'Missing required fields' }, { status: 400 })
  }

  try {
    await resend.emails.send({
      from: 'St. Kyrillos Website <onboarding@resend.dev>',
      to: TO_EMAIL,
      replyTo: email,
      subject: `New Membership Form — ${firstName} ${lastName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto; color: #222;">
          <h2 style="color: #4a1c23; border-bottom: 2px solid #c9a84c; padding-bottom: 8px;">
            New Membership Application
          </h2>

          <table style="width:100%; border-collapse: collapse; margin-top: 16px;">
            <tr><td style="padding: 8px 0; color: #666; width: 160px;">Full Name</td>
                <td style="padding: 8px 0; font-weight: 600;">${firstName} ${lastName}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding: 8px 0; color: #666;">Email</td>
                <td style="padding: 8px 0;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Phone</td>
                <td style="padding: 8px 0;">${phone || '—'}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding: 8px 0; color: #666;">Address</td>
                <td style="padding: 8px 0;">${[address, city, state, zip].filter(Boolean).join(', ') || '—'}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Date of Birth</td>
                <td style="padding: 8px 0;">${dob || '—'}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding: 8px 0; color: #666;">Gender</td>
                <td style="padding: 8px 0;">${gender || '—'}</td></tr>
            <tr><td style="padding: 8px 0; color: #666;">Marital Status</td>
                <td style="padding: 8px 0;">${maritalStatus || '—'}</td></tr>
            <tr style="background:#f9f9f9"><td style="padding: 8px 0; color: #666;">Has Children</td>
                <td style="padding: 8px 0;">${hasChildren || '—'}</td></tr>
          </table>

          <p style="margin-top: 24px; font-size: 13px; color: #999;">
            Submitted via the St. Kyrillos website membership form.
            Reply directly to this email to contact the applicant.
          </p>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Membership email error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}

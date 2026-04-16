import { NextRequest, NextResponse } from 'next/server'
import { Resend } from 'resend'

const TO_EMAIL = 'fr.pachom@stkyrillostn.org'

export async function POST(req: NextRequest) {
  const resend = new Resend(process.env.RESEND_API_KEY2)
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
      from: 'St. Kyrillos Website <noreply@stkyrillostn.org>',
      to: TO_EMAIL,
      replyTo: email,
      subject: `New Member — ${firstName} ${lastName}`,
      html: `
        <div style="font-family: sans-serif; max-width: 580px; margin: 0 auto; color: #222; line-height: 1.6;">
          <p>Hello Father,</p>
          <p>A new member has signed up. Here is their info:</p>

          <table style="width:100%; border-collapse: collapse; margin: 16px 0;">
            <tr><td style="padding: 7px 12px; color: #666; width: 150px; background:#f7f7f7;">Name</td>
                <td style="padding: 7px 12px;">${firstName} ${lastName}</td></tr>
            <tr><td style="padding: 7px 12px; color: #666; background:#f0f0f0;">Email</td>
                <td style="padding: 7px 12px;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding: 7px 12px; color: #666; background:#f7f7f7;">Phone</td>
                <td style="padding: 7px 12px;">${phone}</td></tr>
            <tr><td style="padding: 7px 12px; color: #666; background:#f0f0f0;">Address</td>
                <td style="padding: 7px 12px;">${[address, city, state, zip].filter(Boolean).join(', ')}</td></tr>
            <tr><td style="padding: 7px 12px; color: #666; background:#f7f7f7;">Date of Birth</td>
                <td style="padding: 7px 12px;">${dob}</td></tr>
            <tr><td style="padding: 7px 12px; color: #666; background:#f0f0f0;">Gender</td>
                <td style="padding: 7px 12px;">${gender}</td></tr>
            <tr><td style="padding: 7px 12px; color: #666; background:#f7f7f7;">Marital Status</td>
                <td style="padding: 7px 12px;">${maritalStatus}</td></tr>
            <tr><td style="padding: 7px 12px; color: #666; background:#f0f0f0;">Has Children</td>
                <td style="padding: 7px 12px;">${hasChildren}</td></tr>
          </table>
        </div>
      `,
    })

    return NextResponse.json({ ok: true })
  } catch (err) {
    console.error('Membership email error:', err)
    return NextResponse.json({ error: 'Failed to send email' }, { status: 500 })
  }
}

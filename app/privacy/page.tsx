import type { Metadata } from 'next'
import { CHURCH_INFO } from '@/lib/constants'

export const metadata: Metadata = {
  title: 'Privacy Policy',
  description: `Privacy Policy for ${CHURCH_INFO.fullName}.`,
}

export default function PrivacyPolicyPage() {
  const lastUpdated = 'February 2026'

  return (
    <>
      {/* Hero Section */}
      <section className="relative py-16 md:py-24 bg-gradient-to-br from-primary-900 via-primary-950 to-gray-900">
        <div className="container-custom relative z-10">
          <div className="max-w-3xl mx-auto text-center text-white">
            <h1 className="font-serif text-display-2 md:text-display-1 mb-4">
              Privacy Policy
            </h1>
            <p className="text-xl text-white/80">
              Last updated: {lastUpdated}
            </p>
          </div>
        </div>
      </section>

      {/* Content */}
      <section className="section-padding">
        <div className="container-custom">
          <div className="max-w-3xl mx-auto prose-custom">

            <p className="text-body-lg text-gray-700 mb-10">
              {CHURCH_INFO.fullName} ("we," "our," or "the Church") is committed to protecting your
              privacy. This Privacy Policy explains what information we collect when you visit our
              website, how we use it, and how we protect it.
            </p>

            {/* Section 1 */}
            <div className="mb-10">
              <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                1. Information We Collect
              </h2>
              <p className="text-gray-700 mb-4">
                We only collect personal information that you voluntarily provide to us. This may
                include:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 pl-4">
                <li>
                  <strong>Confession appointment bookings</strong> — When you schedule a confession or
                  pastoral appointment through our Calendly booking widget, Calendly collects your name
                  and email address to confirm and manage your appointment. This information is handled
                  by Calendly in accordance with their own privacy policy.
                </li>
                <li>
                  <strong>Usage data</strong> — Like most websites, our hosting provider may
                  automatically collect basic technical information such as your browser type, device,
                  and pages visited. This data is anonymous and used only for maintaining the site.
                </li>
              </ul>
              <p className="text-gray-700 mt-4">
                We do not operate a newsletter, membership portal, or any account-based system.
                We do not collect payment information directly — any giving is handled through
                third-party platforms with their own privacy practices.
              </p>
            </div>

            {/* Section 2 */}
            <div className="mb-10">
              <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                2. How We Use Your Information
              </h2>
              <p className="text-gray-700 mb-4">
                Any information you provide is used solely to fulfill the purpose for which it was
                given — for example, confirming a confession appointment. We do not sell, rent, or
                share your personal information with third parties for marketing purposes.
              </p>
            </div>

            {/* Section 3 */}
            <div className="mb-10">
              <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                3. Third-Party Services
              </h2>
              <p className="text-gray-700 mb-4">
                Our website uses the following third-party services that may collect data
                independently:
              </p>
              <ul className="list-disc list-inside space-y-2 text-gray-700 pl-4">
                <li>
                  <strong>Calendly</strong> — Used for scheduling confession and pastoral
                  appointments. See{' '}
                  <a
                    href="https://calendly.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-900 hover:underline"
                  >
                    Calendly&apos;s Privacy Policy
                  </a>
                  .
                </li>
                <li>
                  <strong>YouTube</strong> — We embed YouTube videos for livestreamed services.
                  YouTube may set cookies when you interact with embedded content. See{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-900 hover:underline"
                  >
                    Google&apos;s Privacy Policy
                  </a>
                  .
                </li>
                <li>
                  <strong>Google Maps</strong> — We embed a Google Maps iframe on our site to help
                  visitors find our location. Google may collect data through this embed. See{' '}
                  <a
                    href="https://policies.google.com/privacy"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-primary-900 hover:underline"
                  >
                    Google&apos;s Privacy Policy
                  </a>
                  .
                </li>
                <li>
                  <strong>Google Calendar</strong> — We embed a public Google Calendar to display
                  our church schedule.
                </li>
                <li>
                  <strong>Facebook</strong> — Our website links to our Facebook page. Clicking those
                  links will take you to Facebook's platform, which operates under their own privacy
                  policy.
                </li>
              </ul>
              <p className="text-gray-700 mt-4">
                We are not responsible for the privacy practices of these third-party services.
                We encourage you to review their policies directly.
              </p>
            </div>

            {/* Section 4 */}
            <div className="mb-10">
              <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                4. Cookies
              </h2>
              <p className="text-gray-700">
                Our website itself does not use cookies to track visitors. However, third-party
                embeds (such as YouTube, Google Maps, and Calendly) may set their own cookies
                on your device when you interact with them. You can manage cookie preferences
                through your browser settings.
              </p>
            </div>

            {/* Section 5 */}
            <div className="mb-10">
              <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                5. Children&apos;s Privacy
              </h2>
              <p className="text-gray-700">
                Our website is not directed at children under the age of 13, and we do not
                knowingly collect personal information from children. If you believe a child has
                submitted personal information to us, please contact us and we will promptly
                remove it.
              </p>
            </div>

            {/* Section 6 */}
            <div className="mb-10">
              <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                6. Data Security
              </h2>
              <p className="text-gray-700">
                We take reasonable steps to protect any information submitted through our website.
                However, no method of transmission over the internet is 100% secure. We encourage
                you to use caution when sharing personal information online.
              </p>
            </div>

            {/* Section 7 */}
            <div className="mb-10">
              <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                7. Changes to This Policy
              </h2>
              <p className="text-gray-700">
                We may update this Privacy Policy from time to time. When we do, we will update
                the "Last updated" date at the top of this page. We encourage you to review this
                page periodically.
              </p>
            </div>

            {/* Section 8 */}
            <div className="mb-10">
              <h2 className="font-serif text-heading-3 text-gray-900 mb-4">
                8. Contact Us
              </h2>
              <p className="text-gray-700 mb-2">
                If you have any questions about this Privacy Policy or how we handle your
                information, please contact us:
              </p>
              <address className="not-italic text-gray-700 space-y-1">
                <p className="font-semibold">{CHURCH_INFO.fullName}</p>
                <p>{CHURCH_INFO.address.street}</p>
                <p>{CHURCH_INFO.address.city}, {CHURCH_INFO.address.state} {CHURCH_INFO.address.zip}</p>
                <p>{CHURCH_INFO.phone}</p>
              </address>
            </div>

            <div className="pt-8 border-t border-gray-200">
              <p className="text-sm text-gray-500">
                {CHURCH_INFO.fullName} is a parish of the{' '}
                <a
                  href={CHURCH_INFO.diocese.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-primary-900 hover:underline"
                >
                  {CHURCH_INFO.diocese.name}
                </a>
                .
              </p>
            </div>

          </div>
        </div>
      </section>
    </>
  )
}

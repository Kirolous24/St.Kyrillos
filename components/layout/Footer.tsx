import Link from 'next/link'
import Image from 'next/image'
import { Facebook, Youtube, Instagram, Mail, Phone, MapPin, ArrowRight, Heart } from 'lucide-react'
import { CHURCH_INFO, SOCIAL_LINKS, FOOTER_LINKS } from '@/lib/constants'
import { SubscribeForm } from '@/components/forms/SubscribeForm'

export function Footer() {
  const currentYear = new Date().getFullYear()

  return (
    <footer className="bg-gradient-to-b from-primary-950 to-black text-white relative overflow-hidden">
      {/* Decorative elements */}
      <div className="absolute top-0 left-0 w-full h-px bg-gradient-to-r from-transparent via-gold/30 to-transparent" />
      <div className="absolute top-20 right-10 w-40 h-40 opacity-5 border-2 border-white rotate-45" />

      {/* Main Footer */}
      <div className="container-custom py-20 relative">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-12 gap-12">
          {/* Church Info - Wider column */}
          <div className="lg:col-span-4">
            <div className="flex items-center gap-4 mb-6">
              <div className="relative">
                <Image
                  src="/images/Logo.jpg"
                  alt={CHURCH_INFO.name}
                  width={56}
                  height={56}
                  className="w-14 h-14 rounded-full object-cover ring-2 ring-gold/30"
                />
              </div>
              <div>
                <span className="font-serif font-semibold text-xl block">
                  {CHURCH_INFO.name}
                </span>
                <span className="text-gold/80 text-sm">Coptic Orthodox Church</span>
              </div>
            </div>
            <p className="text-white/70 leading-relaxed mb-6">
              A community rooted in the ancient Christian faith, welcoming all who seek Christ. Join us in worship, fellowship, and service.
            </p>
            <p className="text-white/50 text-sm">
              Part of the{' '}
              <a
                href={CHURCH_INFO.diocese.url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-gold hover:text-gold-light transition-colors underline decoration-gold/30 hover:decoration-gold underline-offset-2"
              >
                {CHURCH_INFO.diocese.name}
              </a>
            </p>

            {/* Social Links */}
            <div className="mt-8">
              <div className="flex gap-3">
                {[
                  { href: SOCIAL_LINKS.facebook, icon: Facebook, label: 'Facebook' },
                  { href: SOCIAL_LINKS.youtube, icon: Youtube, label: 'YouTube' },
                  { href: SOCIAL_LINKS.instagram, icon: Instagram, label: 'Instagram' },
                ].map((social) => (
                  <a
                    key={social.label}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group w-11 h-11 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center hover:bg-gold hover:border-gold hover:scale-110 transition-all duration-300"
                    aria-label={social.label}
                  >
                    <social.icon className="w-5 h-5 group-hover:scale-110 transition-transform duration-300" />
                  </a>
                ))}
              </div>
            </div>
          </div>

          {/* Quick Links */}
          <div className="lg:col-span-2">
            <h3 className="font-serif font-semibold text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-px bg-gold" />
              Quick Links
            </h3>
            <ul className="space-y-3">
              {FOOTER_LINKS.quickLinks.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="group text-white/70 hover:text-white transition-colors flex items-center gap-2 text-sm"
                  >
                    <ArrowRight className="w-3 h-3 text-gold opacity-0 -translate-x-2 group-hover:opacity-100 group-hover:translate-x-0 transition-all duration-300" />
                    <span>{link.label}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          {/* Contact Info */}
          <div className="lg:col-span-3">
            <h3 className="font-serif font-semibold text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-px bg-gold" />
              Contact Us
            </h3>
            <ul className="space-y-4">
              <li>
                <a
                  href={`https://maps.google.com/?q=${encodeURIComponent(CHURCH_INFO.address.full)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-start gap-3 text-white/70 hover:text-white transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-gold/20 transition-colors">
                    <MapPin className="w-5 h-5 text-gold" />
                  </div>
                  <span className="text-sm pt-2">
                    {CHURCH_INFO.address.street}
                    <br />
                    {CHURCH_INFO.address.city}, {CHURCH_INFO.address.state} {CHURCH_INFO.address.zip}
                  </span>
                </a>
              </li>
              <li>
                <a
                  href={`tel:${CHURCH_INFO.phone.replace(/\D/g, '')}`}
                  className="flex items-center gap-3 text-white/70 hover:text-white transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-gold/20 transition-colors">
                    <Phone className="w-5 h-5 text-gold" />
                  </div>
                  <span className="text-sm">{CHURCH_INFO.phone}</span>
                </a>
              </li>
              <li>
                <a
                  href={`mailto:${CHURCH_INFO.email}`}
                  className="flex items-center gap-3 text-white/70 hover:text-white transition-colors group"
                >
                  <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center flex-shrink-0 group-hover:bg-gold/20 transition-colors">
                    <Mail className="w-5 h-5 text-gold" />
                  </div>
                  <span className="text-sm">{CHURCH_INFO.email}</span>
                </a>
              </li>
            </ul>
          </div>

          {/* Newsletter */}
          <div className="lg:col-span-3">
            <h3 className="font-serif font-semibold text-lg mb-6 flex items-center gap-2">
              <span className="w-8 h-px bg-gold" />
              Stay Connected
            </h3>
            <p className="text-white/70 text-sm mb-6 leading-relaxed">
              Receive updates about services, events, and spiritual resources directly in your inbox.
            </p>
            <SubscribeForm variant="dark" />
          </div>
        </div>
      </div>

      {/* Bottom Bar */}
      <div className="border-t border-white/10">
        <div className="container-custom py-6">
          <div className="flex flex-col sm:flex-row justify-between items-center gap-4">
            <p className="text-white/50 text-sm flex items-center gap-2">
              <span>© {currentYear} {CHURCH_INFO.fullName}</span>
              <span className="text-white/30">|</span>
              <span className="flex items-center gap-1">
                Made with <Heart className="w-3 h-3 text-gold fill-gold" /> for His glory
              </span>
            </p>
            <div className="flex gap-6 text-sm">
              <Link
                href="/privacy"
                className="text-white/50 hover:text-white transition-colors"
              >
                Privacy Policy
              </Link>
            </div>
          </div>
        </div>
      </div>
    </footer>
  )
}

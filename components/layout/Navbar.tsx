'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import { Menu, X, ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CHURCH_INFO, NAV_ITEMS } from '@/lib/constants'
import { Button } from '@/components/ui/Button'

export function Navbar() {
  const [isOpen, setIsOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeDropdown, setActiveDropdown] = useState<string | null>(null)
  const pathname = usePathname()

  // Handle scroll effect
  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 20)
    }
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Close mobile menu on route change
  useEffect(() => {
    setIsOpen(false)
    setActiveDropdown(null)
  }, [pathname])

  // Prevent body scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = 'hidden'
    } else {
      document.body.style.overflow = 'unset'
    }
    return () => {
      document.body.style.overflow = 'unset'
    }
  }, [isOpen])

  const isActive = (href: string) => {
    if (href === '/') return pathname === '/'
    return pathname.startsWith(href)
  }

  return (
    <header
      className={cn(
        'fixed top-0 left-0 right-0 z-50 transition-all duration-500',
        scrolled
          ? 'bg-white/95 backdrop-blur-lg shadow-soft py-2'
          : 'bg-white/90 backdrop-blur-sm py-4'
      )}
    >
      <nav className="container-custom">
        <div className={cn(
          "flex items-center justify-between transition-all duration-300",
          scrolled ? "h-16" : "h-20"
        )}>
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 group">
            <div className="relative">
              <Image
                src="/images/Logo.jpg"
                alt={CHURCH_INFO.name}
                width={48}
                height={48}
                className={cn(
                  "rounded-full object-cover ring-2 ring-gold/30 transition-all duration-300 group-hover:ring-gold",
                  scrolled ? "w-10 h-10" : "w-12 h-12"
                )}
              />
              <div className="absolute inset-0 rounded-full bg-gold/20 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
            <div className="hidden sm:block">
              <span className={cn(
                "font-serif font-semibold transition-all duration-300",
                scrolled
                  ? "text-base text-gray-900 group-hover:text-primary-900"
                  : "text-lg text-gray-900 group-hover:text-primary-900"
              )}>
                {CHURCH_INFO.name}
              </span>
            </div>
          </Link>

          {/* Desktop Navigation */}
          <div className="hidden lg:flex items-center gap-1">
            {NAV_ITEMS.map((item) => (
              <div
                key={item.href}
                className="relative"
                onMouseEnter={() => 'children' in item && setActiveDropdown(item.href)}
                onMouseLeave={() => setActiveDropdown(null)}
              >
                <Link
                  href={item.href}
                  className={cn(
                    'px-4 py-2 rounded-lg text-base font-medium transition-all duration-200 inline-flex items-center gap-1',
                    isActive(item.href)
                      ? 'text-primary-900 bg-primary-50'
                      : 'text-gray-700 hover:text-primary-900 hover:bg-primary-50'
                  )}
                >
                  {item.label}
                  {'children' in item && <ChevronDown className={cn("w-4 h-4 transition-transform", activeDropdown === item.href && "rotate-180")} />}
                </Link>

                {/* Dropdown Menu */}
                {'children' in item && item.children && (
                  <div
                    className={cn(
                      'absolute top-full left-0 mt-1 w-64 bg-white rounded-xl shadow-soft-lg py-2 transition-all duration-200',
                      activeDropdown === item.href
                        ? 'opacity-100 visible translate-y-0'
                        : 'opacity-0 invisible -translate-y-2'
                    )}
                  >
                    {item.children.map((child) => (
                      <Link
                        key={child.href}
                        href={child.href}
                        className={cn(
                          'block px-4 py-3 text-base transition-colors',
                          isActive(child.href)
                            ? 'text-primary-900 bg-primary-50'
                            : 'text-gray-700 hover:text-primary-900 hover:bg-primary-50'
                        )}
                      >
                        {child.label}
                      </Link>
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>

          {/* Desktop CTA */}
          <div className="hidden lg:flex items-center gap-3">
            <Button
              href="/give"
              variant="primary"
              size="sm"
            >
              Give
            </Button>
          </div>

          {/* Mobile Menu Button */}
          <button
            onClick={() => setIsOpen(!isOpen)}
            className="lg:hidden p-2 rounded-lg transition-all duration-300 hover:bg-gray-100 text-gray-900"
            aria-label={isOpen ? 'Close menu' : 'Open menu'}
          >
            <div className="relative w-6 h-6">
              <Menu
                className={cn(
                  'absolute inset-0 w-6 h-6 transition-all duration-300',
                  isOpen ? 'opacity-0 rotate-90' : 'opacity-100 rotate-0'
                )}
              />
              <X
                className={cn(
                  'absolute inset-0 w-6 h-6 transition-all duration-300',
                  isOpen ? 'opacity-100 rotate-0' : 'opacity-0 -rotate-90'
                )}
              />
            </div>
          </button>
        </div>
      </nav>

      {/* Mobile Menu - FIXED VERSION */}
      <div
        className={cn(
          'lg:hidden fixed left-0 right-0 top-0 z-40 transition-all duration-300',
          'bg-white',
          isOpen
            ? 'opacity-100 visible translate-y-0'
            : 'opacity-0 invisible -translate-y-full'
        )}
        style={{ 
          marginTop: scrolled ? '64px' : '80px',
          maxHeight: scrolled ? 'calc(100vh - 64px)' : 'calc(100vh - 80px)'
        }}
      >
        <div className="h-full overflow-y-auto">
          <div className="container-custom py-6">
            <div className="flex flex-col gap-2">
              {NAV_ITEMS.map((item) => (
                <div key={item.href}>
                  {'children' in item && item.children ? (
                    <>
                      <button
                        onClick={() =>
                          setActiveDropdown(
                            activeDropdown === item.href ? null : item.href
                          )
                        }
                        className={cn(
                          'w-full px-4 py-3 rounded-lg text-lg font-medium transition-colors flex items-center justify-between',
                          isActive(item.href)
                            ? 'text-primary-900 bg-primary-50'
                            : 'text-gray-700 hover:bg-gray-50'
                        )}
                      >
                        {item.label}
                        <ChevronDown
                          className={cn(
                            'w-5 h-5 transition-transform',
                            activeDropdown === item.href && 'rotate-180'
                          )}
                        />
                      </button>
                      <div
                        className={cn(
                          'overflow-hidden transition-all duration-300',
                          activeDropdown === item.href
                            ? 'max-h-[500px] opacity-100'
                            : 'max-h-0 opacity-0'
                        )}
                      >
                        <div className="pl-4 py-2 space-y-1">
                          {item.children.map((child) => (
                            <Link
                              key={child.href}
                              href={child.href}
                              className={cn(
                                'block px-4 py-2 rounded-lg text-base transition-colors',
                                isActive(child.href)
                                  ? 'text-primary-900 bg-primary-50'
                                  : 'text-gray-600 hover:text-primary-900 hover:bg-gray-50'
                              )}
                            >
                              {child.label}
                            </Link>
                          ))}
                        </div>
                      </div>
                    </>
                  ) : (
                    <Link
                      href={item.href}
                      className={cn(
                        'block px-4 py-3 rounded-lg text-lg font-medium transition-colors',
                        isActive(item.href)
                          ? 'text-primary-900 bg-primary-50'
                          : 'text-gray-700 hover:bg-gray-50'
                      )}
                    >
                      {item.label}
                    </Link>
                  )}
                </div>
              ))}
            </div>

            {/* Mobile CTA */}
            <div className="mt-8 pt-8 border-t border-gray-200">
              <Button href="/give" variant="primary" size="lg" className="w-full">
                Give Online
              </Button>
            </div>
          </div>
        </div>
      </div>
    </header>
  )
}
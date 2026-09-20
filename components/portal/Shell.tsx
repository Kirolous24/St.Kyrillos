'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Menu, X, LogOut, LayoutDashboard, Users, UserCog, GraduationCap, CalendarCheck,
  Trophy, Cake, ClipboardList, BookOpen, CalendarDays, Megaphone, MessageSquare,
  QrCode, Music, FileBarChart, Settings, ScrollText, Award, HeartHandshake,
  BookMarked, Sparkles,
} from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * The portal chrome, ported from the prototype's `.sidebar` / `.app-topbar`:
 * two cream panels with a 1.5px gold edge floating on the parchment ground,
 * the sidebar crowned by a dark burgundy crest block.
 */

const NAV_ICONS = {
  dashboard: LayoutDashboard, classes: GraduationCap, students: Users, servants: UserCog,
  attendance: CalendarCheck, leaderboard: Trophy, birthdays: Cake, followups: HeartHandshake,
  exams: ClipboardList, lessons: BookOpen, agenda: CalendarDays, announcements: Megaphone,
  feed: MessageSquare, events: CalendarDays, qr: QrCode, hymns: Music, reports: FileBarChart,
  settings: Settings, audit: ScrollText, achievements: Award, readings: BookMarked, points: Sparkles,
} as const

export type NavIcon = keyof typeof NAV_ICONS

export interface NavItem {
  href: string
  label: string
  icon?: NavIcon
  section?: string
}

interface ShellProps {
  nav: NavItem[]
  userName: string
  roleLabel: string
  /** Centre of the top bar: "Academic Year 2026 – 2027 (1743 Coptic)". */
  academicYear: string
  /** Right of the top bar: the birthdays chip, when there is one. */
  topbarChip?: React.ReactNode
  greeting: string
  onSignOut: () => Promise<void>
  headerSlot?: React.ReactNode
  children: React.ReactNode
}

export function Shell({
  nav, userName, roleLabel, academicYear, topbarChip, greeting, onSignOut, headerSlot, children,
}: ShellProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)

  // ── Mobile nav overlay: trap focus, close on Escape, restore focus ──
  useEffect(() => {
    if (open) {
      wasOpenRef.current = true
      panelRef.current?.focus()
    } else if (wasOpenRef.current) {
      wasOpenRef.current = false
      toggleRef.current?.focus()
    }
  }, [open])

  useEffect(() => {
    if (!open) return
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        setOpen(false)
        return
      }
      if (e.key !== 'Tab') return
      const panel = panelRef.current
      if (!panel) return
      const focusables = panel.querySelectorAll<HTMLElement>(
        'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])',
      )
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault()
        last.focus()
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault()
        first.focus()
      }
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [open])

  const isActive = (href: string) =>
    href === '/portal' ? pathname === href : pathname === href || pathname.startsWith(`${href}/`)

  const groups: { section?: string; items: NavItem[] }[] = []
  for (const item of nav) {
    const last = groups[groups.length - 1]
    if (last && last.section === item.section) last.items.push(item)
    else groups.push({ section: item.section, items: [item] })
  }

  // ── The dark crest block that crowns the cream rail (.sb-user) ──
  const crest = (
    <div className="relative overflow-hidden bg-[linear-gradient(165deg,#4A181D_0%,#3D1418_55%,#33100F_100%)] px-5 pb-5 pt-7 text-center">
      <span
        aria-hidden
        className="pointer-events-none absolute inset-0 opacity-[0.03]"
        style={{
          backgroundImage:
            'repeating-linear-gradient(0deg,transparent,transparent 34px,#C89B3C 34px,#C89B3C 35px),repeating-linear-gradient(90deg,transparent,transparent 34px,#C89B3C 34px,#C89B3C 35px)',
        }}
      />
      <Link href="/portal" onClick={() => setOpen(false)} className="relative z-10 block">
        <Image
          src="/images/Logo.png"
          alt=""
          width={70}
          height={70}
          className="mx-auto mb-3 h-[70px] w-[70px] rounded-full border-[3px] border-brand-gold object-cover shadow-[0_4px_14px_rgba(200,155,60,.28)]"
        />
        <p className="font-serif text-[17px] font-bold leading-tight text-white">{userName}</p>
        <p className="mt-1.5 text-[9.5px] font-semibold uppercase tracking-[2px] text-brand-gold">
          {roleLabel}
        </p>
      </Link>
      <p className="relative z-10 mx-auto mt-3 w-fit rounded-full border border-white/[0.14] bg-white/[0.08] px-3.5 py-1 text-[11px] font-semibold text-white/75">
        Sunday School
      </p>
    </div>
  )

  const navList = (
    <nav className="bg-parch-50 py-2.5" aria-label="Portal">
      {groups.map((group, gi) => (
        <div key={group.section ?? `g${gi}`}>
          {group.section && (
            <p
              className={cn(
                'relative px-5 pb-2 pt-4 text-[10.5px] font-bold uppercase tracking-[1.3px] text-[#8B5A0F]',
                gi > 0 &&
                  'before:absolute before:left-5 before:right-5 before:top-0.5 before:h-px before:bg-gradient-to-r before:from-brand-gold/35 before:to-brand-gold/[0.04] before:content-[""]',
              )}
            >
              {group.section}
            </p>
          )}
          {group.items.map((item) => {
            const active = isActive(item.href)
            const Icon = item.icon ? NAV_ICONS[item.icon] : null
            return (
              <Link
                key={item.href}
                href={item.href}
                prefetch
                onClick={() => setOpen(false)}
                aria-current={active ? 'page' : undefined}
                className={cn(
                  'group mx-2.5 my-0.5 flex items-center gap-[11px] rounded-[10px] border-l-[3px] px-4 py-[11px] transition-all duration-200',
                  active
                    ? 'border-brand-gold bg-brand-wash shadow-nav-on'
                    : 'border-transparent hover:translate-x-1 hover:bg-brand-hover',
                )}
              >
                {Icon && (
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-transform duration-200 group-hover:scale-110',
                      active ? 'text-brand-800' : 'text-[#A99A7C] group-hover:text-brand-800',
                    )}
                    aria-hidden
                  />
                )}
                <span
                  className={cn(
                    'truncate text-[12.5px] transition-colors',
                    active ? 'font-bold text-brand-800' : 'font-medium text-[#6B6255] group-hover:text-parch-900',
                  )}
                >
                  {item.label}
                </span>
              </Link>
            )
          })}
        </div>
      ))}

      <div aria-hidden className="mx-4 my-2 h-px bg-gradient-to-r from-brand-gold/35 to-brand-gold/[0.04]" />

      <form action={onSignOut} className="pb-2">
        <button
          type="submit"
          className="mx-2 flex w-[calc(100%-1rem)] items-center gap-[11px] rounded-[10px] px-4 py-2.5 text-[12.5px] font-medium text-red-600 transition-colors hover:bg-red-50"
        >
          <LogOut className="h-5 w-5 shrink-0" aria-hidden /> Sign out
        </button>
      </form>
    </nav>
  )

  const rail = (
    <div className="overflow-hidden rounded-[22px] border-[1.5px] border-brand-gold bg-parch-50 shadow-rail">
      {crest}
      {navList}
    </div>
  )

  return (
    <div className="min-h-screen bg-parch-100 font-body text-parch-900">
      {/* ── Mobile identity bar (.mobile-id-bar) ── */}
      <div className="sticky top-2.5 z-[100] mx-3 mt-2.5 flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-brand-gold bg-parch-50 px-3.5 py-2.5 shadow-panel md:hidden print:hidden">
        <span className="grid h-8 w-8 shrink-0 place-items-center overflow-hidden rounded-[9px] bg-gradient-to-br from-[#8B4513] to-brand-gold">
          <Image src="/images/Logo.png" alt="" width={32} height={32} className="h-full w-full object-cover" />
        </span>
        <span className="min-w-0 flex-1 leading-tight">
          <span className="block truncate text-[12.5px] font-bold text-parch-900">St. Kyrillos VI Sunday School</span>
          <span className="block truncate text-[10.5px] font-semibold text-[#8B5A0F]">{academicYear}</span>
        </span>
        {headerSlot}
        <button
          type="button"
          ref={toggleRef}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-controls="portal-mobile-nav"
          className="rounded-lg p-1.5 text-brand-800 transition-colors hover:bg-brand-wash"
        >
          {open ? <X className="h-5 w-5" aria-hidden /> : <Menu className="h-5 w-5" aria-hidden />}
          <span className="sr-only">Menu</span>
        </button>
      </div>
      {open && (
        <div
          id="portal-mobile-nav"
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-label="Portal navigation"
          tabIndex={-1}
          className="fixed inset-0 z-[90] overflow-y-auto bg-parch-100 px-3 pb-6 pt-3 outline-none md:hidden print:hidden"
        >
          <div className="mb-3 flex justify-end">
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-lg border border-brand-gold/40 bg-parch-50 p-2 text-brand-800"
            >
              <X className="h-5 w-5" aria-hidden />
              <span className="sr-only">Close menu</span>
            </button>
          </div>
          {rail}
        </div>
      )}

      <div className="flex min-h-screen">
        {/* ── Floating cream rail (.sidebar) ── */}
        <aside className="hidden w-[248px] shrink-0 py-3.5 pl-3.5 md:block print:hidden">
          <div className="sticky top-3.5 max-h-[calc(100vh-1.75rem)] overflow-y-auto">{rail}</div>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          {/* ── Floating top bar (.app-topbar) ── */}
          <header className="sticky top-3.5 z-[100] mx-4 mt-3.5 hidden items-center justify-between gap-5 rounded-[20px] border-[1.5px] border-brand-gold bg-parch-50 px-5 py-2 shadow-panel md:flex print:hidden">
            <div className="flex shrink-0 flex-col leading-tight">
              <span className="text-[11px] text-parch-500">{greeting},</span>
              <span className="text-[14px] font-bold text-parch-900">{userName.split(' ')[0]} 👋</span>
            </div>

            <div className="min-w-0 flex-1 text-center leading-snug">
              <p className="truncate text-[13px] font-bold tracking-[0.2px] text-brand-800">
                St. Kyrillos VI Sunday School
              </p>
              <p className="mt-px truncate text-[11px] text-parch-500">{academicYear}</p>
            </div>

            <div className="flex shrink-0 items-center gap-4">
              {topbarChip}
              {headerSlot}
              <span className="relative flex items-center gap-2">
                <span className="relative">
                  <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-brand-gold bg-brand-800 text-[12px] font-bold text-[#E8D3A3] shadow-[0_2px_6px_rgba(200,155,60,.3)]">
                    {userName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')}
                  </span>
                  <span aria-hidden className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-parch-50 bg-[#22C55E]" />
                </span>
                <span className="flex flex-col leading-tight">
                  <span className="text-[12px] font-bold text-parch-900">{userName.split(' ')[0]}</span>
                  <span className="text-[10px] text-parch-500">{roleLabel}</span>
                </span>
              </span>
            </div>
          </header>

          {/* ── Content well (.main-area) ── */}
          <main className="flex-1 px-4 py-5 md:px-8 md:py-7" aria-hidden={open || undefined}>
            <div key={pathname} className="portal-enter mx-auto w-full max-w-[1320px]">
              {children}
            </div>
          </main>
        </div>
      </div>
    </div>
  )
}

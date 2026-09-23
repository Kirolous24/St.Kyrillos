'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname } from 'next/navigation'
import {
  Menu, X, LogOut, LayoutDashboard, Users, UserCog, GraduationCap, CalendarCheck,
  Trophy, Cake, ClipboardList, BookOpen, CalendarDays, Megaphone, MessageSquare,
  QrCode, Music, FileBarChart, Settings, ScrollText, Award, HeartHandshake,
  BookMarked, Sparkles, Library, LifeBuoy, Layers, ChevronDown, Camera, User, ArrowLeft,
} from 'lucide-react'
import { cn } from '@/lib/utils'
// Pure route table — no server imports, so a client component may call it.
import { classWorkspaceNav } from '@/lib/portal/nav'

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
  curriculum: Library, help: LifeBuoy, stage: Layers, photo: Camera, profile: User,
} as const

export type NavIcon = keyof typeof NAV_ICONS

export interface NavItem {
  href: string
  label: string
  icon?: NavIcon
  section?: string
  /**
   * An unread count beside the label — the prototype's Daily Quiz badge.
   * It is read off the same notifications the bell shows, so dismissing one
   * there clears it here; the two can never disagree.
   */
  badge?: number
}

interface ShellProps {
  nav: NavItem[]
  /** The five one-tap phone destinations (see mobileNavForUser). */
  mobileNav: NavItem[]
  /** The topbar avatar dropdown (see userMenuForUser in lib/portal/nav.ts). */
  userMenu: NavItem[]
  userName: string
  roleLabel: string
  /**
   * Classes this user may open, by id. Used to recognise that the current URL is
   * a class, to name it, and to draw its photo in the crest.
   */
  classInfo?: Record<string, { name: string; photo: string | null; stage: string }>
  /** True for the role that gets the class workspace (the prototype's admin). */
  canEnterClassWorkspace?: boolean
  /**
   * The one class whose identity crowns this servant's rail.
   *
   * The prototype gave a servant's sidebar their *class* rather than themselves
   * — class photo, the class's name, its stage — while admins and students got
   * their own face (OG L3997-4002 against L2701-2703). Ours showed the person to
   * everybody, so a servant's rail never said which class they were looking at.
   *
   * Null when there is no single answer: a servant on two classes, or a stage
   * coordinator, keeps the person crest rather than being told they belong to
   * whichever class sorted first.
   */
  crestClassId?: string | null
  /** The signed-in user's photo, when they have uploaded one. */
  userPhoto?: string | null
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
  nav, mobileNav, userMenu, userName, roleLabel, userPhoto, academicYear, topbarChip, greeting, onSignOut, headerSlot, children,
  classInfo = {}, canEnterClassWorkspace = false, crestClassId = null,
}: ShellProps) {
  const [open, setOpen] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const pathname = usePathname()
  const toggleRef = useRef<HTMLButtonElement>(null)
  const panelRef = useRef<HTMLDivElement>(null)
  const wasOpenRef = useRef(false)

  // The prototype's dropdown only closed on its own items; a click anywhere
  // else left it hanging over the page. Close on outside pointer and on Escape.
  useEffect(() => {
    if (!menuOpen) return
    function onPointer(e: PointerEvent) {
      if (!menuRef.current?.contains(e.target as Node)) setMenuOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [menuOpen])

  // Navigating away should not leave the menu open behind the new page.
  useEffect(() => { setMenuOpen(false) }, [pathname])

  // F0784 — the bell is a bare <details>, so the only way to shut it was a
  // second click on the bell itself: on a phone the panel sat over the page
  // while you tried to read what was underneath it. The avatar menu beside it
  // has closed on an outside pointer and on Escape since it was built; the bell
  // lives in the same topbar (it arrives here as headerSlot) and now behaves the
  // same way. Matched on the bell's own summary label so the month accordions,
  // stage sections and servant groups — all <details> too — are left alone.
  useEffect(() => {
    function closeBells(inside: Node | null) {
      document.querySelectorAll<HTMLDetailsElement>('details[open]').forEach((d) => {
        const label = d.querySelector('summary')?.getAttribute('aria-label') ?? ''
        if (!label.startsWith('Notifications')) return
        if (inside && d.contains(inside)) return
        d.open = false
      })
    }
    const onPointer = (e: PointerEvent) => closeBells(e.target as Node)
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') closeBells(null) }
    document.addEventListener('pointerdown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [])

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

  // A plain prefix test lights up every ancestor row at once. Now that the
  // servant rail carries both "Attendance Report" (/portal/reports) and
  // "Student Reports" (/portal/reports/cards), standing on the cards page lit
  // two rows and neither one looked like the page you were on. Only the most
  // specific href that matches wins, resolved per list so the rail and the
  // phone bar each highlight exactly one of their own entries.
  // Compared on the href's PATH, not the whole string: several rails point at a
  // query ("Church Reports" is /portal/reports?tab=church, "QR Points" is
  // /portal/qr?tab=group&mode=points), and a whole-string compare meant an admin
  // standing on /portal/reports had no row highlighted at all — the rail could
  // not say which page you were on.
  const matches = (href: string) => {
    const path = href.split('?')[0]!
    return path === '/portal' ? pathname === path : pathname === path || pathname.startsWith(`${path}/`)
  }
  const mostSpecific = (hrefs: readonly string[]) => {
    let best: string | null = null
    let bestLen = -1
    for (const href of hrefs) {
      // Ranked on the path, so "?tab=group&mode=points" cannot out-specific a
      // genuinely deeper route like /portal/reports/cards.
      const len = href.split('?')[0]!.length
      if (matches(href) && len > bestLen) { best = href; bestLen = len }
    }
    return best
  }
  /**
   * The prototype's `adOpenClassView` (OG L2643): opening a class put the admin
   * into that class's workspace, with an "Admin View" pill and a way back out.
   * It did that by rewriting `_me` — swapping role and class onto the signed-in
   * user — because the old app had two separate page trees and the admin's had
   * no class workspace.
   *
   * Here it is only the rail that changes. Nothing about the signed-in user is
   * touched, no request carries a different identity, and every write is still
   * recorded against the admin who made it. That is the line F0163 drew: the old
   * app's *other* switch took over a named servant's uid, and this is not that.
   *
   * Derived from the URL rather than passed down, because this layout is shared
   * across every portal route and does not re-render when you navigate into a
   * class.
   */
  const classMatch = /^\/portal\/classes\/([^/?#]+)/.exec(pathname)
  const workspaceClassId = canEnterClassWorkspace && classMatch ? classMatch[1]! : null
  const inClassWorkspace = !!workspaceClassId && !!classInfo[workspaceClassId]
  const shownNav = inClassWorkspace ? classWorkspaceNav(workspaceClassId!, true) : nav

  // The class whose identity crowns the rail: the one an admin has opened, or
  // the servant's own. The prototype did both through the same block.
  const crestId = (inClassWorkspace ? workspaceClassId : crestClassId) ?? null
  const crestClass = crestId ? classInfo[crestId] : undefined

  const activeHref = mostSpecific(shownNav.map((n) => n.href))
  const activeMobileHref = mostSpecific(mobileNav.map((n) => n.href))

  const groups: { section?: string; items: NavItem[] }[] = []
  for (const item of shownNav) {
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
      {crestClass ? (
        /* The prototype's servant crest (OG L3997-4002): the class, not the
           person — its photo, its name, its stage — and the whole block opens
           that class's profile. A servant's own name and photo are still in the
           topbar avatar, so nothing is lost by giving this space to the class.
           The rename pencil the prototype had is deliberately absent: it renamed
           only that one servant's sidebar label and nothing else, which is a
           listed defect (and F0840, which the church declined). */
        <Link
          href={`/portal/classes/${crestId}`}
          onClick={() => setOpen(false)}
          className="relative z-10 block"
        >
          {crestClass.photo ? (
            <Image
              src={crestClass.photo}
              alt=""
              width={70}
              height={70}
              className="mx-auto mb-3 h-[70px] w-[70px] rounded-full border-[3px] border-brand-gold object-cover shadow-[0_4px_14px_rgba(200,155,60,.28)]"
            />
          ) : (
            <span className="mx-auto mb-3 grid h-[70px] w-[70px] place-items-center rounded-full border-[3px] border-brand-gold bg-[linear-gradient(135deg,#8B4513,#C89B3C)] shadow-[0_4px_14px_rgba(200,155,60,.28)]">
              <GraduationCap className="h-7 w-7 text-white" aria-hidden />
            </span>
          )}
          <p className="font-serif text-[17px] font-bold leading-tight text-white">{crestClass.name}</p>
          <p className="mt-1.5 text-[9.5px] font-semibold uppercase tracking-[2px] text-brand-gold">
            {inClassWorkspace ? roleLabel : crestClass.stage}
          </p>
        </Link>
      ) : (
        <Link href="/portal" onClick={() => setOpen(false)} className="relative z-10 block">
          {/* F0154 — the crest carried the church logo for everyone. The
              prototype showed the person themselves here; their name and role are
              already underneath, so the logo was the one element saying nothing
              the rest of the block did not. Falls back to the logo. */}
          <Image
            src={userPhoto || '/images/Logo.png'}
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
      )}
      {/* The prototype's "Admin View" pill and "Exit to Admin" button
          (OG L4002-4003). The pill has to say the class: a rail of class-scoped
          rows with nothing naming the class is how an admin takes the register
          for the wrong one. */}
      {inClassWorkspace ? (
        <>
          <p className="relative z-10 mx-auto mt-3 w-fit rounded-full border border-brand-gold/50 bg-brand-gold/20 px-3.5 py-1 text-[11px] font-bold text-[#F5E3BC]">
            Admin View · {crestClass?.name ?? 'class'}
          </p>
          <Link
            href="/portal/classes"
            onClick={() => setOpen(false)}
            className="relative z-10 mt-3 flex items-center justify-center gap-2 rounded-[10px] border border-white/[0.25] bg-white/[0.12] px-3 py-2 text-[11.5px] font-bold text-white transition-colors hover:bg-white/[0.2]"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden /> Exit to Admin
          </Link>
        </>
      ) : (
        <p className="relative z-10 mx-auto mt-3 w-fit rounded-full border border-white/[0.14] bg-white/[0.08] px-3.5 py-1 text-[11px] font-semibold text-white/75">
          Sunday School
        </p>
      )}
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
            const active = item.href === activeHref
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
                {item.badge ? (
                  <span className="ml-auto grid h-[18px] min-w-[18px] shrink-0 place-items-center rounded-full bg-brand-800 px-1 text-[10px] font-bold text-[#E8D3A3]">
                    <span className="sr-only">, </span>
                    {item.badge > 9 ? '9+' : item.badge}
                    <span className="sr-only"> new</span>
                  </span>
                ) : null}
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
      {/* ── Mobile identity bar (.mobile-id-bar) ──
          It is an *identity* bar: the prototype showed who you are signed in
          as and made the whole card a tap through to your own profile
          (populateMobileIdBar, OG L1734-1748). The port had put the church's
          logo and name here instead, which every page already says and which
          nothing could be done with. Church branding moved to the slide-out
          panel's header, where it is on the way to the crest. */}
      <div className="sticky top-2.5 z-[100] mx-3 mt-2.5 flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-brand-gold bg-parch-50 px-3.5 py-2.5 shadow-panel md:hidden print:hidden">
        <Link href="/portal/profile" className="flex min-w-0 flex-1 items-center gap-2.5">
          {userPhoto ? (
            <Image
              src={userPhoto}
              alt=""
              width={32}
              height={32}
              className="h-8 w-8 shrink-0 rounded-full border-2 border-brand-gold object-cover"
            />
          ) : (
            <span className="grid h-8 w-8 shrink-0 place-items-center rounded-full border-2 border-brand-gold bg-brand-800 text-[11px] font-bold text-[#E8D3A3]">
              {userName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')}
            </span>
          )}
          <span className="min-w-0 flex-1 leading-tight">
            <span className="block truncate text-[12.5px] font-bold text-parch-900">{userName}</span>
            <span className="block truncate text-[10.5px] font-semibold text-[#8B5A0F]">{roleLabel}</span>
          </span>
        </Link>
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
          // Above the sticky identity bar (z-100) and the bottom bar (z-200).
          // At z-90 the identity bar floated over the open menu and swallowed
          // taps in that strip, including the panel's own close button.
          className="fixed inset-0 z-[400] overflow-y-auto bg-parch-100 px-3 pb-6 pt-3 outline-none md:hidden print:hidden"
        >
          <div className="mb-3 flex items-center justify-between gap-3">
            <span className="min-w-0 leading-tight">
              <span className="block truncate text-[12.5px] font-bold text-parch-900">St. Kyrillos VI Sunday School</span>
              <span className="block truncate text-[10.5px] font-semibold text-[#8B5A0F]">{academicYear}</span>
            </span>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="shrink-0 rounded-lg border border-brand-gold/40 bg-parch-50 p-2 text-brand-800"
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
              <div ref={menuRef} className="relative">
                <button
                  type="button"
                  onClick={() => setMenuOpen((v) => !v)}
                  aria-expanded={menuOpen}
                  aria-haspopup="menu"
                  className="flex items-center gap-2 rounded-full py-0.5 pl-0.5 pr-1.5 transition-colors hover:bg-brand-wash"
                >
                  <span className="relative">
                    {/* F0168 — the photo, when there is one. The column and the
                        uploader have existed since /portal/photo was built; the
                        desktop topbar was the one place that never read it, so a
                        servant who uploaded a photo saw it nowhere. */}
                    {userPhoto ? (
                      <Image
                        src={userPhoto}
                        alt=""
                        width={40}
                        height={40}
                        className="h-10 w-10 rounded-full border-2 border-brand-gold object-cover shadow-[0_2px_6px_rgba(200,155,60,.3)]"
                      />
                    ) : (
                      <span className="grid h-10 w-10 place-items-center rounded-full border-2 border-brand-gold bg-brand-800 text-[12px] font-bold text-[#E8D3A3] shadow-[0_2px_6px_rgba(200,155,60,.3)]">
                        {userName.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join('')}
                      </span>
                    )}
                    <span aria-hidden className="absolute -bottom-px -right-px h-2.5 w-2.5 rounded-full border-2 border-parch-50 bg-[#22C55E]" />
                  </span>
                  <span className="flex min-w-0 flex-col leading-tight text-left">
                    {/* The prototype named the person in full here. A first name
                        alone is ambiguous in a church with several Minas. */}
                    <span className="max-w-[140px] truncate text-[12px] font-bold text-parch-900">{userName}</span>
                    <span className="text-[10px] text-parch-500">{roleLabel}</span>
                  </span>
                  <ChevronDown
                    className={cn('h-3.5 w-3.5 text-parch-500 transition-transform', menuOpen && 'rotate-180')}
                    aria-hidden
                  />
                  <span className="sr-only">Account menu</span>
                </button>

                {menuOpen && (
                  <div
                    role="menu"
                    aria-label="Account menu"
                    className="absolute right-0 top-[calc(100%+10px)] z-[300] w-[210px] overflow-hidden rounded-[14px] border border-[#E7E2DA] bg-parch-50 p-1.5 shadow-[0_12px_32px_rgba(0,0,0,.14)]"
                  >
                    {userMenu.map((item) => {
                      const Icon = item.icon ? NAV_ICONS[item.icon] : null
                      return (
                        <Link
                          key={item.href}
                          href={item.href}
                          role="menuitem"
                          onClick={() => setMenuOpen(false)}
                          className="flex items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[12.5px] font-semibold text-[#374151] transition-colors hover:bg-[#F8F4EC]"
                        >
                          {Icon ? <Icon className="h-[15px] w-[15px] shrink-0 text-[#8B5A0F]" aria-hidden /> : null}
                          {item.label}
                        </Link>
                      )
                    })}
                    <div className="my-1.5 h-px bg-[#E7E2DA]" role="separator" />
                    <form action={onSignOut}>
                      <button
                        type="submit"
                        role="menuitem"
                        className="flex w-full items-center gap-2.5 rounded-[9px] px-3 py-2.5 text-[12.5px] font-semibold text-[#DC2626] transition-colors hover:bg-[#F8F4EC]"
                      >
                        <LogOut className="h-[15px] w-[15px] shrink-0 text-[#DC2626]" aria-hidden /> Sign out
                      </button>
                    </form>
                  </div>
                )}
              </div>
            </div>
          </header>

          {/* ── Content well (.main-area) ── */}
          <main className="flex-1 px-4 pb-[84px] pt-5 md:px-8 md:py-7 md:pb-7" aria-hidden={open || undefined}>
            <div key={pathname} className="portal-enter mx-auto w-full max-w-[1320px]">
              {children}
            </div>
          </main>
        </div>
      </div>

      {/* ── Mobile bottom nav (.mob-bottom-nav) ──
          64px, #4A1212, five one-tap destinations plus More, with the gold
          top-edge marker on the active tab exactly as the prototype had it. */}
      <nav
        aria-label="Primary"
        className="fixed inset-x-0 bottom-0 z-[200] flex h-16 items-stretch border-t border-white/10 bg-[#4A1212] shadow-[0_-4px_16px_rgba(0,0,0,.2)] md:hidden print:hidden"
      >
        {mobileNav.map((item) => {
          const Icon = item.icon ? NAV_ICONS[item.icon] : null
          const active = item.href === activeMobileHref
          // F0031 — the bottom bar is the only navigation a student on a phone
          // ever sees, so a count that lives only in the sidebar reaches nobody:
          // a new quiz sat there unannounced until they happened to open the
          // drawer. Read off the already-badged sidebar items by href, so the
          // bar and the rail can never disagree and no tab can carry a count the
          // sidebar does not have.
          const badge = nav.find((n) => n.href === item.href)?.badge
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? 'page' : undefined}
              className={cn(
                'flex flex-1 flex-col items-center justify-center gap-[3px] px-1 py-2 transition-colors active:bg-white/15',
                active ? 'border-t-2 border-brand-gold bg-white/10 text-white' : 'text-white/55',
              )}
            >
              <span className="relative">
                {Icon ? <Icon className="h-[19px] w-[19px]" aria-hidden /> : null}
                {badge ? (
                  <span
                    data-mobile-badge={item.href}
                    className="absolute -right-2.5 -top-1.5 grid h-[16px] min-w-[16px] place-items-center rounded-full bg-[#DC2626] px-1 text-[9px] font-bold leading-none text-white"
                  >
                    <span className="sr-only">, </span>
                    {badge > 9 ? '9+' : badge}
                    <span className="sr-only"> new</span>
                  </span>
                ) : null}
              </span>
              <span className="text-[10px] font-semibold tracking-[0.1px]">{item.label}</span>
            </Link>
          )
        })}
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-expanded={open}
          aria-controls="portal-mobile-nav"
          className="flex flex-1 flex-col items-center justify-center gap-[3px] px-1 py-2 text-white/55 transition-colors active:bg-white/15"
        >
          <Menu className="h-[19px] w-[19px]" aria-hidden />
          <span className="text-[10px] font-semibold tracking-[0.1px]">More</span>
        </button>
      </nav>
    </div>
  )
}
